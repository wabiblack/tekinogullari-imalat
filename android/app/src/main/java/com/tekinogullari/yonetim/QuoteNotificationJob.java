package com.tekinogullari.yonetim;

import android.Manifest;
import android.app.Activity;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import javax.net.ssl.HttpsURLConnection;

public final class QuoteNotificationJob extends JobService {
    private static final int JOB_ID = 62821;
    private static final int NOTIFICATION_ID = 62822;
    private static final String CHANNEL_ID = "tekin_quote_alerts";
    private static final String TAG = "TekinQuoteAlerts";
    private static final String POLL_URL =
        "https://xrlipgbetpohjewhlbml.supabase.co/functions/v1/tek-notification-poll";
    private static final long FIFTEEN_MINUTES = 15 * 60 * 1000L;

    public static void schedule(Context ctx) {
        JobScheduler scheduler = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler == null) return;
        JobInfo info = new JobInfo.Builder(JOB_ID,
            new ComponentName(ctx, QuoteNotificationJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(FIFTEEN_MINUTES)
            .setPersisted(true)
            .build();
        scheduler.schedule(info);
    }

    public static void stop(Context ctx) {
        JobScheduler scheduler = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler != null) scheduler.cancel(JOB_ID);
    }

    public static void checkImmediately(Context ctx) {
        Context app = ctx.getApplicationContext();
        new Thread(() -> poll(app), "QuoteAlertImmediatePoll").start();
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try {
                poll(getApplicationContext());
            } finally {
                jobFinished(params, false);
            }
        }, "QuoteAlertScheduledPoll").start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    private static void poll(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences("tekin_device_notifications", Context.MODE_PRIVATE);
        String token = prefs.getString("device_token", "");
        if (token == null || !token.matches("^[0-9a-f]{64}$")) return;
        HttpsURLConnection connection = null;
        try {
            connection = (HttpsURLConnection) new URL(POLL_URL).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(12000);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setUseCaches(false);
            connection.setDoOutput(true);
            byte[] json = new JSONObject().put("device_token", token)
                .toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream stream = connection.getOutputStream()) {
                stream.write(json);
            }
            if (connection.getResponseCode() != 200) {
                Log.w(TAG, "Quote check HTTP " + connection.getResponseCode());
                return;
            }
            StringBuilder text = new StringBuilder();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[4096];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (text.length() > 16000) break;
                    text.append(new String(buffer, 0, count, StandardCharsets.UTF_8));
                }
            }
            JSONObject response = new JSONObject(text.toString());
            int newCount = Math.max(0, response.optInt("new_count", 0));
            int approaching = Math.max(0, response.optInt("due_upcoming", 0));
            int dueToday = Math.max(0, response.optInt("due_today", 0));
            int overdue = Math.max(0, response.optInt("due_overdue", 0));
            if (newCount > 0) notifyNewQuotes(ctx, newCount);
            if (approaching + dueToday + overdue > 0) notifyDelivery(ctx, approaching, dueToday, overdue);
        } catch (Exception e) {
            Log.w(TAG, "Background quote check will retry", e);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }


    private static void notifyDelivery(Context ctx, int approaching, int dueToday, int overdue) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = (NotificationManager)ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || !manager.areNotificationsEnabled()) return;
        String channelId = "tekin_delivery_alerts";
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(channelId,"İş Teslimatları",NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Yaklaşan ve geciken iş teslim tarihleri");
            manager.createNotificationChannel(channel);
        }
        StringBuilder body = new StringBuilder();
        if(overdue > 0) body.append(overdue).append(" geciken iş");
        if(dueToday > 0) {
            if(body.length()>0) body.append(", ");
            body.append(dueToday).append(" bugün teslim");
        }
        if(approaching > 0) {
            if(body.length()>0) body.append(", ");
            body.append(approaching).append(" yaklaşan teslimat");
        }
        Intent intent = new Intent(ctx,MainActivity.class)
            .setAction("com.tekinogullari.yonetim.OPEN_JOBS")
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(ctx,1,intent,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?
            new Notification.Builder(ctx,channelId):new Notification.Builder(ctx);
        builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("Tekinoğulları • Teslimat Hatırlatması")
            .setContentText(body.toString())
            .setStyle(new Notification.BigTextStyle().bigText(body.toString()))
            .setContentIntent(pending)
            .setAutoCancel(true);
        manager.notify(62823,builder.build());
    }

    private static void notifyNewQuotes(Context ctx, int count) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager manager = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || !manager.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Yeni Teklifler", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Yeni müşteri teklifleri geldiğinde bilgi verir");
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(ctx, MainActivity.class)
            .setAction("com.tekinogullari.yonetim.OPEN_QUOTES")
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String body = count == 1 ? "Yeni bir müşteri teklif talebi geldi." :
            count + " yeni müşteri teklif talebi geldi.";
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ?
            new Notification.Builder(ctx, CHANNEL_ID) : new Notification.Builder(ctx);
        builder.setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle("Tekinoğulları • Yeni Teklif")
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setContentIntent(pending)
            .setAutoCancel(true);
        manager.notify(NOTIFICATION_ID, builder.build());
    }
}
