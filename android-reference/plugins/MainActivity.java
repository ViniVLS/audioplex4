package com.audioplex4;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.audioplex4.plugins.FfmpegConverterPlugin;
import com.audioplex4.plugins.MediaSaverPlugin;
import com.audioplex4.plugins.BackgroundAudioPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FfmpegConverterPlugin.class);
        registerPlugin(MediaSaverPlugin.class);
        registerPlugin(BackgroundAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}