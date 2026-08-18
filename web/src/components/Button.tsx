/**
 * Buttons.
 *
 * Three jobs, and the difference between them is a rule, not a preference:
 *   primary    — an ordinary action a person takes. --action blue (CLAUDE.md §5:
 *                "everything a person does uses the action blue").
 *   emergency  — asking for help. The ONE loud element in the product.
 *   quiet      — everything secondary. Achromatic, bordered, no fill.
 *
 * Press feedback fires on pointer-down via :active, not on release, so the control feels
 * like it heard you. The action itself still fires on click, because firing on
 * pointer-down would remove the ability to slide off and cancel, and would not match how
 * the keyboard activates a button.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'emergency' | 'quiet';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Emergency controls are bigger: they are pressed in a hurry, possibly one-handed. */
  size?: 'md' | 'lg';
  children: ReactNode;
};

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--action)',
    color: 'var(--paper-raised)',
    border: '1px solid var(--action)',
  },
  emergency: {
    background: 'var(--lvl-warning)',
    color: 'var(--on-warning)',
    border: '1px solid var(--lvl-warning)',
  },
  quiet: {
    background: 'transparent',
    color: 'var(--fg)',
    // --edge, not --hairline: a control's boundary has to clear 3:1 to be a boundary.
    border: '1px solid var(--edge)',
  },
};

export function Button({ variant = 'primary', size = 'md', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      data-variant={variant}
      className={`ng-button display ${rest.className ?? ''}`}
      style={{
        ...VARIANT_STYLE[variant],
        minHeight: size === 'lg' ? 'var(--tap-sos)' : 'var(--tap-min)',
        fontSize: size === 'lg' ? 'var(--size-title)' : 'var(--size-body)',
        ...rest.style,
      }}
    >
      {children}
    </button>
  );
}
