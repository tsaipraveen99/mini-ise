// A condensed M with a column of status lights standing in for the I: allow, quarantine, deny.
export function LogoMark({ className, title = 'Mini ISE' }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 50 40"
      xmlns="http://www.w3.org/2000/svg"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <path fill="currentColor" d="M0 40V0h9l8 17 8-17h9v40h-8V16l-7 14h-4l-7-14v24z" />
      {/* The I is a signal housing with three lights, so it reads as a status column, not punctuation. */}
      <rect x="37" y="0" width="13" height="40" rx="3" fill="currentColor" />
      <circle cx="43.5" cy="7.5" r="3.6" fill="#2FB373" />
      <circle cx="43.5" cy="20" r="3.6" fill="#E0A21B" />
      <circle cx="43.5" cy="32.5" r="3.6" fill="#E5533F" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark className="logo-mark" title="" />
      <span className="logo-word">Mini ISE</span>
    </span>
  )
}
