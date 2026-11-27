import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TpmData} from './services/tpm-data';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly tpmData = inject(TpmData);

  readonly user = this.tpmData.user;
  readonly isCloudConnected = this.tpmData.isCloudConnected;
  readonly errorMessage = this.tpmData.errorMessage;
  readonly mobileMenuOpen = signal<boolean>(false);

  readonly navItems = [
    {path: '/bitacora', label: 'Bitácora'},
    {path: '/maquinaria', label: 'Maquinaria'},
    {path: '/historial', label: 'Historial'},
    {path: '/dashboard', label: 'Dashboard'},
  ];

  async connectFirebase(): Promise<void> {
    await this.tpmData.signInWithGoogle();
  }

  async disconnectFirebase(): Promise<void> {
    await this.tpmData.signOutUser();
  }

  dismissError(): void {
    this.tpmData.clearError();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
