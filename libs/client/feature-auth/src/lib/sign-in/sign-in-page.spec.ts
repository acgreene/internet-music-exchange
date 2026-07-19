import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignInPage } from './sign-in-page';

describe('SignInPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignInPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the sign-in window and form', async () => {
    const fixture = TestBed.createComponent(SignInPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Sign in');
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
    expect(compiled.querySelector('input[type="password"]')).toBeTruthy();
  });
});
