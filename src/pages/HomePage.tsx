import { Hero } from '../components/Hero';
import { Services } from '../components/Services';
import { SocialLinks } from '../components/SocialLinks';

interface HomePageProps {
  onBookNow: () => void;
}

export function HomePage({ onBookNow }: HomePageProps) {
  return (
    <>
      <Hero onBookNow={onBookNow} />
      <Services />
      <SocialLinks />
    </>
  );
}
