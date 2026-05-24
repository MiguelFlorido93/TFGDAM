# kotlinx.serialization: mantener los serializadores generados
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keep,includedescriptorclasses class com.stockly.app.**$$serializer { *; }
-keepclassmembers class com.stockly.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.stockly.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * { @retrofit2.http.* <methods>; }
-dontwarn org.codehaus.mojo.animal_sniffer.*
-dontwarn javax.annotation.**
