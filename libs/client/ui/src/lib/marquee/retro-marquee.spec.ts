import { TestBed } from '@angular/core/testing';
import { RetroMarquee } from './retro-marquee';

describe('RetroMarquee', () => {
  it('renders every item twice for a seamless loop', async () => {
    await TestBed.configureTestingModule({
      imports: [RetroMarquee],
    }).compileComponents();

    const fixture = TestBed.createComponent(RetroMarquee);
    fixture.componentRef.setInput('items', ['zero platform cut', 'est. 2026']);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.match(/zero platform cut/g)?.length).toBe(2);
    expect(text.match(/est\. 2026/g)?.length).toBe(2);
  });
});
