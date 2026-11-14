import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { driver, type Config, type Driver, type DriveStep } from 'driver.js';

export interface TourStepConfig {
  element: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly document = inject(DOCUMENT);
  private driverInstance: Driver | null = null;

  /** Standard steps for the panel modules guided tour. */
  readonly panelSteps: readonly TourStepConfig[] = [
    {
      element: '.brand',
      title: 'melZone Panel',
      description:
        'Central administrative backoffice for Melia. Curate places, moderate social interactions, manage accounts, and audit platform events.',
      side: 'right',
      align: 'start',
    },
    {
      element: '.nav',
      title: 'Navigation Catalogue',
      description:
        'Administrative modules grouped by domain. The panel administers and moderates platform data; it never acts as a participant.',
      side: 'right',
      align: 'start',
    },
    {
      element: '[data-tour="module-overview"]',
      title: 'Overview',
      description:
        'Platform pulse: operational counters for accounts, roles, permissions, and audit entries, plus recent system activity.',
      side: 'right',
      align: 'center',
    },
    {
      element: '[data-tour="module-places"]',
      title: 'Places Backoffice',
      description:
        'Curate venues: edit identity, location, weekly schedules, taxonomy attributes, dining menus, and reorder photo galleries without re-uploading bytes.',
      side: 'right',
      align: 'center',
    },
    {
      element: '[data-tour="module-reviews"]',
      title: 'Reviews Moderation',
      description:
        'Moderate customer place reviews. Toggle row status between ACTIVE, INACTIVE, and MODERATED without permanently deleting author history.',
      side: 'right',
      align: 'center',
    },
    {
      element: '[data-tour="module-plans"]',
      title: 'Plans Moderation',
      description:
        'Suspend or restore group plans. Suspending a plan hides it from discovery while leaving itinerary access intact for its owner and members.',
      side: 'right',
      align: 'center',
    },
    {
      element: '[data-tour="module-invitations"]',
      title: 'Invitations Audit',
      description:
        'Inspect plan invitation lifecycles across the platform and revoke pending invitations if reported for abuse or spam.',
      side: 'right',
      align: 'center',
    },
    {
      element: '[data-tour="module-users"]',
      title: 'Users & Roles',
      description:
        'Invite new operators, manage account status, send password reset codes, and replace assigned role bundles.',
      side: 'right',
      align: 'center',
    },
    {
      element: '[data-tour="module-audit"]',
      title: 'Audit Log',
      description:
        'Detailed security and operational log. Filter events by action kind, actor user id, and date ranges.',
      side: 'right',
      align: 'center',
    },
    {
      element: '.who',
      title: 'Operator Session',
      description:
        'Your authenticated session and assigned roles. The panel dynamically displays modules according to your effective permissions.',
      side: 'top',
      align: 'start',
    },
    {
      element: '.theme-toggle',
      title: 'Theme Preference',
      description:
        'Switch between light and dark themes. The chosen theme applies instantly and is persisted in local storage.',
      side: 'bottom',
      align: 'end',
    },
  ];

  /** Starts the panel guided walkthrough. */
  startPanelTour(customSteps?: readonly TourStepConfig[]): Driver | null {
    const rawSteps = customSteps ?? this.panelSteps;

    // Filter to only elements currently present in the DOM
    const activeSteps: DriveStep[] = rawSteps
      .filter((step) => !!this.document.querySelector(step.element))
      .map((step) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side ?? 'right',
          align: step.align ?? 'start',
        },
      }));

    if (activeSteps.length === 0) {
      return null;
    }

    const config: Config = {
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(11, 18, 32, 0.7)',
      stagePadding: 5,
      stageRadius: 8,
      popoverClass: 'melzone-tour-popover',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: activeSteps,
      onDestroyed: () => {
        this.driverInstance = null;
      },
    };

    this.driverInstance = driver(config);
    this.driverInstance.drive();
    return this.driverInstance;
  }

  /** Terminates an active tour if running. */
  stopTour(): void {
    if (this.driverInstance) {
      this.driverInstance.destroy();
      this.driverInstance = null;
    }
  }

  /** Whether a tour is currently driving. */
  isTourActive(): boolean {
    return this.driverInstance?.isActive() ?? false;
  }
}
