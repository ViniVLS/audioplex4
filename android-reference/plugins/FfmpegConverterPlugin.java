package com.audioplex4.plugins;

import android.util.Log;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegKitConfig;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.FFprobeKit;
import com.arthenica.ffmpegkit.MediaInformation;
import com.arthenica.ffmpegkit.MediaInformationSession;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "FfmpegConverter")
public class FfmpegConverterPlugin extends Plugin {

    private static final String TAG = "FfmpegConverter";

    @PluginMethod
    public void convert(PluginCall call) {
        String inputPath = call.getString("inputPath");
        String outputPath = call.getString("outputPath");
        String codec = call.getString("codec", "libmp3lame");
        String bitrate = call.getString("bitrate", "320k");
        int sampleRate = call.getInt("sampleRate", 44100);
        int channels = call.getInt("channels", 2);

        if (inputPath == null || outputPath == null) {
            call.reject("inputPath e outputPath são obrigatórios.");
            return;
        }

        File inputFile = new File(inputPath);
        if (!inputFile.exists()) {
            call.reject("Arquivo de entrada não encontrado: " + inputPath);
            return;
        }

        String extension = outputPath.endsWith(".mp3") ? "mp3"
                         : outputPath.endsWith(".aac") ? "aac"
                         : outputPath.endsWith(".m4a") ? "m4a"
                         : outputPath.endsWith(".wav") ? "wav"
                         : "mp3";

        StringBuilder cmd = new StringBuilder();
        cmd.append("-y -i \"").append(inputPath).append("\"");

        if ("mp3".equals(extension)) {
            cmd.append(" -codec:a libmp3lame -b:a ").append(bitrate);
        } else if ("aac".equals(extension) || "m4a".equals(extension)) {
            cmd.append(" -codec:a aac -b:a ").append(bitrate);
        } else if ("wav".equals(extension)) {
            cmd.append(" -codec:a pcm_s16le");
        } else {
            cmd.append(" -codec:a ").append(codec).append(" -b:a ").append(bitrate);
        }

        cmd.append(" -ar ").append(sampleRate);
        cmd.append(" -ac ").append(channels);
        cmd.append(" \"").append(outputPath).append("\"");

        String ffmpegCmd = cmd.toString();
        Log.d(TAG, "Executando FFmpeg: " + ffmpegCmd);

        try {
            FFmpegSession session = FFmpegKit.execute(ffmpegCmd);
            int returnCode = session.getReturnCode().getValue();

            if (returnCode == 0) {
                File outputFile = new File(outputPath);
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("outputPath", outputPath);
                result.put("outputSize", outputFile.length());
                call.resolve(result);
            } else {
                String output = session.getAllLogsAsString();
                Log.e(TAG, "FFmpeg falhou: " + output);
                call.reject("FFmpeg falhou com código " + returnCode, String.valueOf(returnCode));
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao executar FFmpeg", e);
            call.reject("Erro ao executar FFmpeg: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("path é obrigatório.");
            return;
        }

        try {
            MediaInformationSession session = FFprobeKit.getMediaInformation(path);
            MediaInformation info = session.getMediaInformation();
            JSObject result = new JSObject();
            if (info != null) {
                result.put("duration", info.getDuration());
                result.put("bitrate", info.getBitrate());
                if (info.getStreams() != null && info.getStreams().size() > 0) {
                    result.put("streams", info.getStreams().size());
                }
            }
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Erro ao obter informações: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAvailableEncoders(PluginCall call) {
        try {
            String[] encoders = FFmpegKitConfig.getFFmpegEncoders();
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("encoders", encoders != null ? String.join(",", encoders) : "");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Erro ao listar encoders: " + e.getMessage());
        }
    }
}