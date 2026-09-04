package com.audioplex4.plugins;

import android.content.ComponentName;
import android.util.Log;

import androidx.core.content.ContextCompat;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.common.util.concurrent.ListenableFuture;

/**
 * Player de áudio nativo (Media3/ExoPlayer) com foreground service.
 * Permite reprodução em background no Android, ao contrário do
 * HTMLAudioElement do WebView, que pausa quando o app vai para o plano de fundo.
 */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {

    private static final String TAG = "BackgroundAudio";

    private MediaController controller;
    private boolean controllerReady = false;

    private void ensureController(PluginCall call, Runnable onReady) {
        if (controllerReady && controller != null) {
            onReady.run();
            return;
        }

        SessionToken token = new SessionToken(
            getContext(),
            new ComponentName(getContext(), MediaPlaybackService.class)
        );

        MediaController.Builder builder = new MediaController.Builder(getContext(), token);
        ListenableFuture<MediaController> future = builder.buildAsync();

        future.addListener(() -> {
            try {
                controller = future.get();
                controllerReady = true;
                onReady.run();
            } catch (Exception e) {
                Log.e(TAG, "Falha ao conectar ao MediaPlaybackService", e);
                call.reject("Falha ao conectar ao player: " + e.getMessage());
            }
        }, ContextCompat.getMainExecutor(getContext()));
    }

    @PluginMethod
    public void setSource(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "AudioPlex4");

        if (url == null) {
            call.reject("url é obrigatório.");
            return;
        }

        ensureController(call, () -> {
            MediaItem item = new MediaItem.Builder()
                .setUri(url)
                .setMediaId(title)
                .build();
            controller.setMediaItem(item);
            controller.prepare();
            call.resolve();
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        ensureController(call, () -> {
            controller.play();
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        ensureController(call, () -> {
            controller.pause();
            call.resolve();
        });
    }

    @PluginMethod
    public void seek(PluginCall call) {
        int seconds = call.getInt("seconds", 0);
        ensureController(call, () -> {
            controller.seekTo(seconds * 1000L);
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        double volume = call.getDouble("volume", 1.0);
        ensureController(call, () -> {
            controller.setVolume((float) volume);
            call.resolve();
        });
    }

    @PluginMethod
    public void isPlaying(PluginCall call) {
        ensureController(call, () -> {
            JSObject result = new JSObject();
            result.put("playing", controller.isPlaying());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        ensureController(call, () -> {
            long position = controller.getCurrentPosition();
            long duration = controller.getDuration();

            JSObject result = new JSObject();
            result.put("playing", controller.isPlaying());
            result.put("position", Math.max(0, position == C.TIME_UNSET ? 0 : position));
            result.put("duration", duration == C.TIME_UNSET ? 0 : duration);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (controllerReady && controller != null) {
            controller.stop();
            controller.release();
            controller = null;
            controllerReady = false;
        }
        call.resolve();
    }
}