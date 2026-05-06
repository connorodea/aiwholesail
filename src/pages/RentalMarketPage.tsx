import { useParams } from 'react-router-dom';

export default function RentalMarketPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4 capitalize">
        {slug?.replace(/-/g, ' ') || 'Rental Market'}
      </h1>
      <p className="text-muted-foreground">This rental market report is coming soon.</p>
    </div>
  );
}
