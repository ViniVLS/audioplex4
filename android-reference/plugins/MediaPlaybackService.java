package com.audioplex4.plugins;

import android.content.Intent;

import androidx.annotation.Nullable;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Foreground service baseado em Media3 que mantém o áudio tocando em
 * background (notificação + controles de lock screen).
 */
public class MediaPlaybackService extends MediaSessionService {

    private MediaSession mediaSession;

    @Override
    public void onCreate() {
        super.onCreate();
        ExoPlayer player = new ExoPlayer.Builder(this).build();
        mediaSession = new MediaSession.Builder(this, player).build();
    }

    @Nullable
    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // App removido da lista de recentes: pausa e garante que a notificação some.
        if (mediaSession != null && mediaSession.getPlayer() != null) {
            mediaSession.getPlayer().pause();
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            Player player = mediaSession.getPlayer();
            mediaSession.release();
            if (player != null) {
                player.release();
            }
            mediaSession = null;
        }
        super.onDestroy();
    }
}