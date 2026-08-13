import { Hero } from '../components/Hero';
import { Services } from '../components/Services';
import { SocialLinks } from '../components/SocialLinks';
import { BookingRoad } from '../components/BookingRoad';

interface HomePageProps {
  onBookNow: () => void;
}

export function HomePage({ onBookNow }: HomePageProps) {
  return (
    <div className="home-page">
      <BookingRoad pageSelector=".home-page" variant="home" />
      <Hero onBookNow={onBookNow} />
      <Services />
      <SocialLinks />
    </div>
  );
}
