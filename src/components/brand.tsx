import Image from "next/image";
import { brand } from "@/lib/brand";

type SeaRidersLogoProps = {
  href?: string;
  subtitle?: string;
  light?: boolean;
  compact?: boolean;
};

export function SeaRidersLogo({
  href,
  subtitle,
  light = false,
  compact = false,
}: SeaRidersLogoProps) {
  const content = (
    <>
      <span className={`brand-lockup__mark${light ? " brand-lockup__mark--light" : ""}`}>
        <Image src="/logo-seariders.png" alt="SeaRiders" width={46} height={46} className="brand-lockup__image" />
      </span>
      <span className="brand-lockup__copy">
        <span className={`brand-lockup__title${light ? " brand-lockup__title--light" : ""}`}>
          {compact ? brand.name : brand.adminName}
        </span>
        {subtitle ? (
          <span className={`brand-lockup__subtitle${light ? " brand-lockup__subtitle--light" : ""}`}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!href) {
    return <div className="brand-lockup">{content}</div>;
  }

  return (
    <a href={href} className="brand-lockup brand-lockup--link">
      {content}
    </a>
  );
}

export function PublicBrandHeader({
  eyebrow,
  title,
  subtitle,
  logoHref,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  logoHref?: string;
}) {
  return (
    <header className="public-brand-card">
      <div className="public-brand-card__top">
        <SeaRidersLogo
          href={logoHref}
          subtitle="SeaRiders ecosystem"
          compact
        />
        <span className="public-brand-card__eyebrow">{eyebrow}</span>
      </div>
      <div className="public-brand-card__body">
        <h1 className="public-brand-card__title">{title}</h1>
        <p className="public-brand-card__subtitle">{subtitle}</p>
      </div>
    </header>
  );
}
