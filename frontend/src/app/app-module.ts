import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, provideHttpClient, withInterceptors } from '@angular/common/http';

import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSidenavModule } from '@angular/material/sidenav';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ToastrModule } from 'ngx-toastr';

import { AppRoutingModule } from './app-routing-module';
import { AppComponent } from './app';
import { LoginComponent } from './features/auth/login.component';
import { AuthCallbackComponent } from './features/auth/auth-callback.component';
import { HomeComponent } from './features/home/home.component';
import { MiniPlayerComponent } from './features/player/mini-player.component';
import { NowPlayingComponent } from './features/player/now-playing.component';
import { QueueDrawerComponent } from './features/player/queue-drawer.component';
import { authInterceptor } from './core/interceptors/auth.interceptor';

@NgModule({
    declarations: [
        AppComponent,
        LoginComponent,
        AuthCallbackComponent,
        HomeComponent,
        MiniPlayerComponent,
        NowPlayingComponent,
        QueueDrawerComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        HttpClientModule,
        AppRoutingModule,
        MatInputModule,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatRadioModule,
        MatFormFieldModule,
        MatSelectModule,
        MatExpansionModule,
        MatSnackBarModule,
        MatTabsModule,
        MatSliderModule,
        MatTooltipModule,
        MatMenuModule,
        MatDividerModule,
        MatSidenavModule,
        DragDropModule,
        ToastrModule.forRoot({
            timeOut: 3500,
            positionClass: 'toast-top-right',
            preventDuplicates: true,
            progressBar: true
        })
    ],
    providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideBrowserGlobalErrorListeners()
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
