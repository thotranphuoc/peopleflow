import { Directive, ElementRef, OnInit } from '@angular/core';

/** Focus input khi phần tử được tạo (dùng cho ô chuyển từ text sang input). */
@Directive({ selector: '[appFocusInput]', standalone: true })
export class FocusInputDirective implements OnInit {
  constructor(private el: ElementRef<HTMLInputElement>) {}

  ngOnInit(): void {
    setTimeout(() => this.el.nativeElement.focus(), 0);
  }
}
