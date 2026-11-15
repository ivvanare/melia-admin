import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, type Me } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { TourService } from '../core/tour.service';
import { PanelLayout } from './panel-layout';

const OPERATOR: Me = {
  id: 'u-admin',
  name: 'Admin User',
  email: 'admin@melia.test',
  status: 'ACTIVE',
  email_verified_at: '2026-01-01T00:00:00Z',
  roles: ['SUPERADMIN'],
  permissions: [
    'admin.access',
    'place.update',
    'place.manage_all',
    'review.moderate',
    'plan.moderate',
    'invitation.moderate',
  ],
  created_at: '2026-01-01T00:00:00Z',
};

describe('PanelLayout', () => {
  const user = signal<Me | null>(OPERATOR);
  const permissions = signal<string[]>(OPERATOR.permissions);
  const isDark = signal(false);
  const toggleTheme = vi.fn();
  const startPanelTour = vi.fn();

  beforeEach(() => {
    user.set(OPERATOR);
    permissions.set(OPERATOR.permissions);
    isDark.set(false);
    toggleTheme.mockClear();
    startPanelTour.mockClear();

    TestBed.configureTestingModule({
      imports: [PanelLayout],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: user.asReadonly(),
            permissions: permissions.asReadonly(),
            logout: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            isDark: isDark.asReadonly(),
            toggle: toggleTheme,
          },
        },
        {
          provide: TourService,
          useValue: {
            startPanelTour,
            stopTour: vi.fn(),
            isTourActive: vi.fn().mockReturnValue(false),
          },
        },
      ],
    });
  });

  it('renders navigation catalogue with tour data attributes', () => {
    const fixture = TestBed.createComponent(PanelLayout);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const placesItem = element.querySelector('[data-tour="module-places"]');
    expect(placesItem).not.toBeNull();
    expect(placesItem?.textContent).toContain('Places');

    const reviewsItem = element.querySelector('[data-tour="module-reviews"]');
    expect(reviewsItem).not.toBeNull();
    expect(reviewsItem?.textContent).toContain('Reviews');
  });

  it('triggers the guided tour when the Tour button is clicked', () => {
    const fixture = TestBed.createComponent(PanelLayout);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const tourBtn = element.querySelector('.tour-btn') as HTMLButtonElement | null;
    expect(tourBtn).not.toBeNull();
    tourBtn?.click();

    expect(startPanelTour).toHaveBeenCalledOnce();
  });

  it('toggles sidebar minimization when collapse button or topbar toggle is clicked', () => {
    const fixture = TestBed.createComponent(PanelLayout);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const shell = element.querySelector('.shell') as HTMLElement;

    expect(shell.classList.contains('collapsed')).toBe(false);

    const collapseBtn = element.querySelector('.collapse-btn') as HTMLButtonElement | null;
    expect(collapseBtn).not.toBeNull();
    collapseBtn?.click();
    fixture.detectChanges();

    expect(shell.classList.contains('collapsed')).toBe(true);

    const topbarToggle = element.querySelector('.menu-toggle-btn') as HTMLButtonElement | null;
    expect(topbarToggle).not.toBeNull();
    topbarToggle?.click();
    fixture.detectChanges();

    expect(shell.classList.contains('collapsed')).toBe(false);
  });
});
