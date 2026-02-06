import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, X, Trash2, ShoppingCart, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Appointment, Client, Pet, Service } from '@/types';
import { format } from 'date-fns';

interface CheckoutProps {
  appointments: Appointment[];
  clients: Client[];
  pets: Pet[];
  services: Service[];
  onUpdateAppointment: (id: string, appointment: Partial<Appointment>) => void;
}

interface CheckoutItem {
  service_id?: string;
  service_name: string;
  price: number;
  quantity: number;
}

export function Checkout({ appointments, clients, pets, services, onUpdateAppointment }: CheckoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const appointmentId = location.state?.appointmentId;
  
  const appointment = useMemo(() => {
    return appointments.find(a => a.id === appointmentId);
  }, [appointments, appointmentId]);

  const [items, setItems] = useState<CheckoutItem[]>(() => {
    if (appointment) {
      return [{
        service_name: appointment.service_type,
        price: appointment.price,
        quantity: 1,
      }];
    }
    return [];
  });

  const [tip, setTip] = useState(0);
  const [tipType, setTipType] = useState<'percent' | 'amount'>('percent');
  const [tipValue, setTipValue] = useState(0);

  const client = useMemo(() => {
    if (!appointment) return null;
    const pet = pets.find(p => p.id === appointment.pet_id);
    return pet ? clients.find(c => c.id === pet.client_id) : null;
  }, [appointment, pets, clients]);

  const pet = useMemo(() => {
    return appointment ? pets.find(p => p.id === appointment.pet_id) : null;
  }, [appointment, pets]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const tipAmount = useMemo(() => {
    if (tipType === 'percent') {
      return subtotal * (tipValue / 100);
    }
    return tipValue;
  }, [tipType, tipValue, subtotal]);

  const total = subtotal + tipAmount;

  const handleAddService = () => {
    setItems([...items, {
      service_name: '',
      price: 0,
      quantity: 1,
    }]);
  };

  const handleRemoveService = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleServiceChange = (index: number, serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        service_id: service.id,
        service_name: service.name,
        price: service.price,
      };
      setItems(newItems);
    }
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, quantity);
    setItems(newItems);
  };

  const handlePriceChange = (index: number, price: number) => {
    const newItems = [...items];
    newItems[index].price = price;
    setItems(newItems);
  };

  const handleProceedToPayment = () => {
    // Update appointment with new items and total
    if (appointment) {
      const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      onUpdateAppointment(appointment.id, {
        price: totalPrice + tipAmount,
        service_type: items.map(i => i.service_name).join(', '),
      });
    }
    navigate('/payment', {
      state: {
        appointmentId: appointment?.id,
        items,
        subtotal,
        tip: tipAmount,
        total,
      },
    });
  };

  if (!appointment || !client || !pet) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No appointment selected for checkout.</p>
            <Button onClick={() => navigate('/appointments')} className="mt-4">
              Go to Appointments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        <p className="text-muted-foreground mt-1">
          Review and finalize appointment details
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Information */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="font-semibold">{client.first_name} {client.last_name}</p>
                <p className="text-sm text-muted-foreground">{client.email}</p>
                <p className="text-sm text-muted-foreground">{client.phone}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="font-semibold">Pet: {pet.name}</p>
                <p className="text-sm text-muted-foreground">
                  {pet.breed} • {pet.species}
                </p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-sm">
                  <span className="font-semibold">Appointment Date:</span>{' '}
                  {format(new Date(appointment.scheduled_date), 'PPP p')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Services</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddService}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Service
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-4 p-4 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Label>Service</Label>
                      {services.length > 0 ? (
                        <Select
                          value={item.service_id || ''}
                          onValueChange={(value) => handleServiceChange(index, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a service" />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map(service => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={item.service_name}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].service_name = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="Service name"
                        />
                      )}
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, Number(e.target.value))}
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label>Price ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => handlePriceChange(index, Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveService(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm sticky top-4">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>
                      {item.service_name} × {item.quantity}
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between mb-2">
                  <span>Subtotal</span>
                  <span className="font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="space-y-2 pt-2">
                  <Label>Tip</Label>
                  <div className="flex gap-2">
                    <Select value={tipType} onValueChange={(v: 'percent' | 'amount') => setTipType(v)}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">$</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step={tipType === 'percent' ? '1' : '0.01'}
                      value={tipValue}
                      onChange={(e) => setTipValue(Number(e.target.value))}
                      placeholder={tipType === 'percent' ? '15' : '5.00'}
                    />
                  </div>
                  {tipAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tip Amount</span>
                      <span>${tipAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
              <Button
                onClick={handleProceedToPayment}
                className="w-full mt-4 shadow-sm flex items-center gap-2"
                size="lg"
              >
                <CreditCard className="w-4 h-4" />
                Proceed to Payment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
