/**
 * Buttons.
 *
 * Three jobs, and the difference between them is a rule, not a preference (CLAUDE.md §5):
 *   primary    — a routine, low-stakes action. --action blue.
 *   emergency  — the moment is critical. Warning red, and the ONE loud element here.
 *                Red is not "a person acted", it is "this is critical" — which is why the
 *                emergency request carries it and the register button does not.
 *   quiet      — everything secondary. Achromatic, bordered, no fill.
 *   text       — third tier: back, skip, dismiss. No border at all, because a bordered
 *                control at the edge of a screen competes with the one thing on it.
 *
 * Press feedback fires on pointer-down via :active, not on release, so the control feels
 * like it heard you. The action itself still fires on click, because firing on
 * pointer-down would remove the ability to slide off and cancel, and would not match how
 * the keyboard activates a button.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'emergency' | 'quiet' | 'text';

type CommonProps = {
  variant?: ButtonVariant;
  /** Emergency controls are bigger: they are pressed in a hurry, possibly one-handed. */
  size?: 'md' | 'lg';
  children: ReactNode;
};

/**
 * `href` renders an anchor instead of a button. A control that navigates IS a link, and
 * wrapping a <button> in an <a> — which is what this replaced — is invalid HTML that
 * browsers resolve inconsistently, leaving two focus stops for one control.
 */
type ButtonProps = CommonProps &
  (
    | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  );

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
  text: {
    background: 'transparent',
    color: 'var(--fg-muted)',
    border: '1px solid transparent',
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    padding: '0 0.25em',
  },
};

export function Button({ variant = 'primary', size = 'md', children, ...rest }: ButtonProps) {
  const style: React.CSSProperties = {
    ...VARIANT_STYLE[variant],
    minHeight: size === 'lg' ? 'var(--tap-sos)' : 'var(--tap-min)',
    fontSize: size === 'lg' ? 'var(--size-lead)' : 'var(--size-body)',
    ...rest.style,
  };
  const className = `ng-button display ${rest.className ?? ''}`;

  if (typeof rest.href === 'string') {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        {...anchorProps}
        data-variant={variant}
        className={className}
        style={{ ...style, textDecoration: 'none' }}
      >
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" {...buttonProps} data-variant={variant} className={className} style={style}>
      {children}
    </button>
  );
}
