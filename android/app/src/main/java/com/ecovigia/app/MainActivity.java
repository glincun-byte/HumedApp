package com.ecovigia.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen; // 1. IMPORTAR ESTO
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 2. INSTALAR EL SPLASH ANTES de super.onCreate
        SplashScreen.installSplashScreen(this);

        super.onCreate(savedInstanceState);
    }
}
