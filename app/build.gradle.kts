import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.TaskAction

plugins {
    id("com.android.application")
}

android {
    namespace = "com.dorota.forma"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.dorota.forma"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

}

abstract class SyncWebAssetsTask : DefaultTask() {
    @get:InputFiles
    abstract val sourceFiles: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun syncFiles() {
        project.copy {
            from(sourceFiles)
            into(outputDirectory)
        }
    }
}

val syncWebAssets = tasks.register<SyncWebAssetsTask>("syncWebAssets") {
    sourceFiles.from(
        rootProject.file("index.html"),
        rootProject.file("styles.css"),
        rootProject.file("app.js")
    )
    outputDirectory.set(layout.buildDirectory.dir("generated/webAssets"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(syncWebAssets) {
            it.outputDirectory
        }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.16.0")
}
