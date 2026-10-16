plugins {
    id("com.android.application")
}

android {
    namespace = "com.tekinogullari.yonetim"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.tekinogullari.yonetim"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.1"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
