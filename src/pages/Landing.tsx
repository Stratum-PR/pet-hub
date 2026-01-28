import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Calendar, Users, DollarSign, ArrowRight, Check } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/stratum hub logo.svg" alt="Stratum Hub" className="h-10" />
          <span className="text-xl font-semibold">Stratum Hub</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link to="/pricing">
            <Button>Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Professional Pet Grooming
          <br />
          <span className="text-primary">Management Made Simple</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Streamline your grooming business with powerful scheduling, customer management, 
          and revenue tracking tools. Start your free trial today.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/pricing">
            <Button size="lg" className="text-lg px-8">
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link to="/login?demo=1">
            <Button size="lg" variant="outline" className="text-lg px-8">
              View Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Easy Scheduling</h3>
            <p className="text-muted-foreground">
              Manage appointments effortlessly with our intuitive calendar system. 
              Never double-book again with real-time availability.
            </p>
          </div>

          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Customer Management</h3>
            <p className="text-muted-foreground">
              Keep detailed records of your clients and their pets. Track preferences, 
              history, and special instructions all in one place.
            </p>
          </div>

          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Revenue Tracking</h3>
            <p className="text-muted-foreground">
              Monitor your business performance with comprehensive analytics. 
              Track revenue, appointments, and growth metrics.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="bg-card p-12 rounded-lg shadow-sm border max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Choose the plan that fits your business. All plans include a 14-day free trial.
          </p>
          <Link to="/pricing">
            <Button size="lg" className="text-lg px-8">
              View Pricing Plans
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
