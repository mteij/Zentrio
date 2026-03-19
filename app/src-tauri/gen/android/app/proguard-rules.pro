# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Keep Tauri plugin framework classes (loaded via reflection at runtime)
-keep class app.tauri.** { *; }
-dontwarn app.tauri.**

# Keep custom Tauri plugin classes and their @Command methods
-keep @app.tauri.annotation.TauriPlugin class * { *; }
-keep class com.zentrio.mteij.ExoPlayerPlugin { *; }
-keep class com.zentrio.mteij.TvLauncherPlugin { *; }
-keep class com.zentrio.mteij.ImmersiveModePlugin { *; }

# Keep @InvokeArg classes (deserialized from JSON via reflection)
-keep @app.tauri.annotation.InvokeArg class * { *; }