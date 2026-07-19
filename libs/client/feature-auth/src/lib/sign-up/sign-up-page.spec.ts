import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignUpPage } from './sign-up-page';

describe('SignUpPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignUpPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the create account window and form', async () => {
    const fixture = TestBed.createComponent(SignUpPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Create account');
    expect(compiled.querySelectorAll('input[type="password"]').length).toBe(2);
  });
});
