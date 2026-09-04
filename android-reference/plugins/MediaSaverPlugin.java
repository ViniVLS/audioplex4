package com.audioplex4.plugins;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "MediaSaver")
public class MediaSaverPlugin extends Plugin {

    private static final String TAG = "MediaSaver";

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String filePath = call.getString("filePath");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "audio/mpeg");

        if (filePath == null || fileName == null) {
            call.reject("filePath e fileName são obrigatórios.");
            return;
        }

        File srcFile = new File(filePath);
        if (!srcFile.exists()) {
            call.reject("Arquivo de origem não encontrado: " + filePath);
            return;
        }

        try {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/AudioPlex4");
            }

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

            if (uri == null) {
                call.reject("Erro ao criar entrada no MediaStore.");
                return;
            }

            try (InputStream in = new FileInputStream(srcFile);
                 OutputStream out = resolver.openOutputStream(uri)) {

                if (out == null) {
                    call.reject("Erro ao abrir stream de saída.");
                    return;
                }

                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = in.read(buffer)) != -1) {
                    out.write(buffer, 0, bytesRead);
                }
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", uri.toString());
            result.put("fileName", fileName);
            result.put("fileSize", srcFile.length());
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Erro ao salvar arquivo", e);
            call.reject("Erro ao salvar arquivo: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDownloadsPath(PluginCall call) {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File audioPlexDir = new File(downloadsDir, "AudioPlex4");

        if (!audioPlexDir.exists()) {
            audioPlexDir.mkdirs();
        }

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("path", audioPlexDir.getAbsolutePath());
        call.resolve(result);
    }

    @PluginMethod
    public void listDownloads(PluginCall call) {
        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File audioPlexDir = new File(downloadsDir, "AudioPlex4");

        JSObject result = new JSObject();
        if (!audioPlexDir.exists()) {
            result.put("success", true);
            result.put("files", new Object[0]);
            call.resolve(result);
            return;
        }

        File[] files = audioPlexDir.listFiles();
        if (files == null) files = new File[0];

        Object[] fileList = new Object[files.length];
        for (int i = 0; i < files.length; i++) {
            JSObject fileInfo = new JSObject();
            fileInfo.put("name", files[i].getName());
            fileInfo.put("path", files[i].getAbsolutePath());
            fileInfo.put("size", files[i].length());
            fileInfo.put("lastModified", files[i].lastModified());
            fileList[i] = fileInfo;
        }

        result.put("success", true);
        result.put("files", fileList);
        call.resolve(result);
    }
}