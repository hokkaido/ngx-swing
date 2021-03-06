import {
  Component,
  HostListener,
  HostBinding,
  Host,
  Output,
  EventEmitter
} from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { animate, style, trigger, state, transition, AnimationEvent, keyframes, group } from '@angular/animations';
import { Direction } from './direction';
import { Offset } from './offset';
import { Dimension } from './dimension';
import { SwingStackDirective } from './swing-stack.directive';


@Component({
  // tslint:disable-next-line:component-selector
  selector: 'swing-card,[swingCard]',
  template: `<ng-content></ng-content>`,
  animations: [
    trigger('cardState', [
      transition('* => throwOut',
        animate('500ms cubic-bezier(0.310, 0.440, 0.445, 1.650)',
          keyframes([
            style({ transform: 'translate({{ x }}px, {{ y }}px) rotate({{ rotation }}deg)' })
          ])
        )
      ),
      transition('* => throwIn',
        animate('500ms cubic-bezier(0.310, 0.440, 0.445, 1.650)',
          keyframes([
            style({
              transform: 'translate(0px, 0px) rotate({{rotation}}deg)',
              offset: 0.6
            }),
            style({
              transform: 'translate3d({{ horizontalVelocity }}px, {{ verticalVelocity }}px, 0)',
              offset: 0.80,
            }),
          ])
        )
      )
    ])
  ]
})
export class SwingCardComponent {

  @HostBinding('@cardState') get cardState(): any {
    return { value: this._cardState, params: this._animationParams };
  }

  @HostBinding('style.transform') get transform(): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(
      `translate3d(0, 0, 0) translate(${this._offset.x}px, ${this._offset.y}px) rotate(${this._rotation}deg)`
    );
  }

  private _offset: Offset = { x: 0, y: 0 };
  private _rotation = 0;
  private _lastMove: any = {};

  private _cardState: CardState = CardState.free;
  private _animationParams: any = {};

  private _rotationFactor = 20;
  private _velocityFactor = 5;


  @HostBinding('attr.direction-x') 
  get _directionX(): Direction {
    return this._offset.x === 0 ? undefined : this._offset.x < 0 ? Direction.Left : Direction.Right;
  }

  @HostBinding('attr.direction-y') 
  get _directionY(): Direction {
    return this._offset.y === 0 ? undefined : this._offset.y < 0 ? Direction.Up : Direction.Down;
  }

  @HostBinding('attr.offset-state')  
  get _offsetState(): OffsetState {
    return  this._offset.y !== 0 && this._offset.x !== 0 && this._cardState === CardState.free ? OffsetState.moving : OffsetState.stable
  }


  @Output() 
  public readonly cardStateChange: EventEmitter<CardStateEvent> = new EventEmitter<CardStateEvent>();

  @Output() 
  public readonly offsetStateChange: EventEmitter<OffsetStateEvent> = new EventEmitter<OffsetStateEvent>();


  constructor(
    @Host()
    private stack: SwingStackDirective,
    private sanitizer: DomSanitizer
  ) { }



  @HostListener('panstart', ["$event"])
  _panstart(event): void {
    this._cardState = CardState.free;
    this._move(event);
  }

  @HostListener('panmove', ['$event'])
  _panmove(event): void {
    this._move(event);
  }

  @HostListener('panend', ['$event'])
  _panend(event): void {
    
    const lastX = this._lastMove.deltaX || 0, lastY = this._lastMove.deltaY || 0;
    const offset = { x: event.deltaX + lastX, y: event.deltaY + lastY };
    const isThrowOut = this.getThrowOutRange(offset) === 1;

    if (isThrowOut) {
      this.throwOut(offset);
    } else {
      this.throwIn(offset)
    }
  }

  _move(event): void {
    const lastX = this._lastMove.deltaX || 0, lastY = this._lastMove.deltaY || 0;
    this._offset = { x: event.deltaX + lastX, y: event.deltaY + lastY };
    this._rotation = this.getRotation(this._offset);
    this._lastMove = event;
    const isThrowOut = this.getThrowOutRange(this._offset) === 1;
    this.offsetStateChange.emit({
      offsetState: OffsetState.moving,
      cardState: isThrowOut ? CardState.throwOut : CardState.throwIn
    })
  }

  @HostListener('@cardState.done', ['$event'])
  _stateAnimationDone(event: AnimationEvent): void {

    if (event.toState == CardState.throwOut) {
      this._offset = { x: this._animationParams.x, y: this._animationParams.y };
      this._rotation = this._animationParams.rotation;
    } else {
      this._offset = { x: 0, y: 0 };
      this._rotation = 0;
    }

  }

  throwIn(offset: Offset): void {

    if( offset.y === 0 || offset.x === 0 ) {
      throw new Error( `Offset.x and Offset.y must be lower or greater than zero.` );
    }

    const verticalAxis = offset.y < 0 ? 1 : -1;
    const horizontalAxis = offset.x < 0 ? 1 : -1;

    const rotation = this.getRotation(offset) / this._velocityFactor;
    const verticalVelocity = this._velocityFactor * verticalAxis;
    const horizontalVelocity = this._velocityFactor * horizontalAxis;

    this._animationParams = { rotation, verticalVelocity, horizontalVelocity }
    this._cardState = CardState.throwIn
    this.cardStateChange.emit({ state: this._cardState });
  }

  throwOut(offset: Offset): void {

    if( offset.y === 0 || offset.x === 0 ) {
      throw new Error( `Offset.x and Offset.y must be lower or greater than zero.` );
    }
  
    const rotation = this.getRotation(offset) * 2;
    const y = offset.y * 2;
    const x = offset.x * 2;

    this._animationParams = { rotation, y, x }
    this._cardState = CardState.throwOut
    this.cardStateChange.emit({ state: this._cardState });
  }

  getRotation(offset: Offset): number {
    const dimension = this.getDimensions();
    const horizontalOffset = Math.min(Math.max(offset.x / dimension.width, -1), 1);
    const verticalOffset = (offset.y > 0 ? 1 : -1) * Math.min(Math.abs(offset.y) / 100, 1);
    return horizontalOffset * verticalOffset * this._rotationFactor;
  }

  getDirection(offset: Offset): Direction {
    const horizontalDirection = offset.x < 0 ? Direction.Left : Direction.Right;
    const verticalDirection = offset.y < 0 ? Direction.Up : Direction.Down;
    return Math.abs(offset.x) > Math.abs(offset.y) ? horizontalDirection : verticalDirection;
  }

  getDimensions(): Dimension {
    return this.stack.getDimensions();
  }

  getThrowOutRange(offset: Offset): number {
    const dimension = this.getDimensions();
    const horizontalConfidence = Math.min(
      Math.abs(offset.x) / dimension.width,
      1
    );
    const verticalConfidence = Math.min(
      Math.abs(offset.y) / dimension.height,
      1
    );
    return Math.max(horizontalConfidence, verticalConfidence);
  }
}


export enum CardState {
  throwIn = 'throwIn',
  throwOut = 'throwOut',
  free = 'free'
}

export interface CardStateEvent{
  card?: SwingCardComponent
  state: CardState
}

export enum OffsetState {
  stable = 'stable',
  moving = 'moving'
}


export interface OffsetStateEvent{
  card?: SwingCardComponent
  offsetState: OffsetState
  cardState: CardState
}
