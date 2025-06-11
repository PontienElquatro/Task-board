import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isLoggedInKey = 'isLoggedIn';

  constructor(private router: Router) {}

  login(email: string, password: string): boolean {
    // Simulation : accepter n’importe quel email/mot de passe
    localStorage.setItem(this.isLoggedInKey, 'true');
    return true;
  }

  register(email: string, password: string): boolean {
    // Stocker localement l’utilisateur (version simple)
    localStorage.setItem('user', JSON.stringify({ email, password }));
    return true;
  }

  logout(): void {
    localStorage.removeItem(this.isLoggedInKey);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return localStorage.getItem(this.isLoggedInKey) === 'true';
  }
}
