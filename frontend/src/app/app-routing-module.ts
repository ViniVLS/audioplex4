import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { HomeComponent } from './features/home/home.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';

// Arquitetura:
// - AppComponent (raiz, sempre montado) = layout global (router-outlet + mini-player futuro)
// - /login       → LoginComponent (rota pública, guard: guestGuard)
// - /            → HomeComponent (rota protegida, guard: authGuard)
//
// Não usamos lazy-loading aqui para que HomeComponent compartilhe o
// AppModule (Material, FormsModule, etc.) sem precisar de schemas extras.
const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: HomeComponent,
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
