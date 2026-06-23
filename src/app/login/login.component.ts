import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private router = inject(Router);

  login() {
    // Simulation simple de connexion
    this.router.navigate(['/board']);
  }
}
