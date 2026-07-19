import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiStatus } from '@ime/models';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
  });

  it('renders the brand and default status', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Internet Music Exchange');
    expect(compiled.textContent).toContain('API checking');
  });

  it('shows sign-in links when signed out', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Sign in');
    expect(compiled.textContent).toContain('Create account');
  });

  it('shows the user and sign out when signed in', async () => {
    fixture.componentRef.setInput('user', {
      id: '5d2b7c9a-8e21-4b6f-8c3d-1a9e8f7b6222',
      email: 'artist@example.com',
      createdAt: '2026-07-17T12:00:00.000Z',
    });
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('artist@example.com');
    expect(compiled.textContent).toContain('Sign out');
  });

  it('reflects the apiStatus input', async () => {
    fixture.componentRef.setInput('apiStatus', ApiStatus.Online);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('API online');
  });
});
