import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TourService } from './tour.service';

describe('TourService', () => {
  let service: TourService;
  let document: Document;
  let testContainer: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TourService],
    });
    service = TestBed.inject(TourService);
    document = TestBed.inject(DOCUMENT);

    testContainer = document.createElement('div');
    testContainer.id = 'tour-test-container';
    testContainer.innerHTML = `
      <div class="brand">melZone</div>
      <div class="nav">
        <a data-tour="module-places">Places</a>
        <a data-tour="module-reviews">Reviews</a>
      </div>
      <div class="who">Operator</div>
      <button class="theme-toggle">Theme</button>
    `;
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    service.stopTour();
    testContainer.remove();
  });

  it('declares the core navigation and operator tour steps', () => {
    expect(service.panelSteps.length).toBeGreaterThanOrEqual(8);
    const selectors = service.panelSteps.map((s) => s.element);
    expect(selectors).toContain('.brand');
    expect(selectors).toContain('.nav');
    expect(selectors).toContain('[data-tour="module-places"]');
    expect(selectors).toContain('[data-tour="module-reviews"]');
    expect(selectors).toContain('.who');
    expect(selectors).toContain('.theme-toggle');
  });

  it('returns null and does not drive when no target elements match the DOM', () => {
    const result = service.startPanelTour([
      { element: '.non-existent-selector-12345', title: 'Ghost', description: 'Not here' },
    ]);
    expect(result).toBeNull();
    expect(service.isTourActive()).toBe(false);
  });

  it('filters active steps to elements present in the DOM and starts tour', () => {
    const driverInstance = service.startPanelTour();
    expect(driverInstance).not.toBeNull();
    expect(service.isTourActive()).toBe(true);
  });

  it('stops and cleans up an active tour instance', () => {
    service.startPanelTour();
    expect(service.isTourActive()).toBe(true);

    service.stopTour();
    expect(service.isTourActive()).toBe(false);
  });
});
