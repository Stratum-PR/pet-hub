import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CreditCard, DollarSign, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appointmentId, items, subtotal, tip, total } = location.state || {};

  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'cash' | 'athmovil'>('credit');
  const [saveCard, setSaveCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Handle different payment methods
    if (paymentMethod === 'credit') {
      // Credit card processing would go here
      // For now, just simulate success
      toast.success('Payment processed successfully!');
    } else if (paymentMethod === 'cash') {
      toast.success('Cash payment recorded!');
    } else if (paymentMethod === 'athmovil') {
      // ATH Móvil integration would go here
      // Using the API: https://github.com/evertec/athmovil-javascript-api
      toast.success('ATH Móvil payment initiated!');
    }
    
    setProcessing(false);
    navigate('/appointments', { state: { paymentSuccess: true } });
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  if (!appointmentId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No payment information available.</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Form */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={(v: 'credit' | 'cash' | 'athmovil') => setPaymentMethod(v)}>
                <div className="flex items-center space-x-2 p-4 border rounded-lg mb-2">
                  <RadioGroupItem value="credit" id="credit" />
                  <Label htmlFor="credit" className="flex-1 cursor-pointer flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Credit Card
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg mb-2">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash" className="flex-1 cursor-pointer flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Cash
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="athmovil" id="athmovil" />
                  <Label htmlFor="athmovil" className="flex-1 cursor-pointer flex items-center gap-2">
                    <Smartphone className="w-5 h-5" />
                    ATH Móvil
                  </Label>
                </div>
              </RadioGroup>

              {paymentMethod === 'credit' && (
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Card Number</Label>
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cardholder Name</Label>
                    <Input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CVV</Label>
                      <Input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
                        placeholder="123"
                        maxLength={4}
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="save-card"
                      checked={saveCard}
                      onCheckedChange={(checked) => setSaveCard(checked as boolean)}
                    />
                    <Label htmlFor="save-card" className="cursor-pointer">
                      Save card for future purchases
                    </Label>
                  </div>
                </div>
              )}

              {paymentMethod === 'cash' && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Cash payment will be recorded. Please collect payment from the client.
                  </p>
                </div>
              )}

              {paymentMethod === 'athmovil' && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      ATH Móvil payment will be processed through the ATH Móvil API.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The client will receive a payment request on their ATH Móvil app.
                    </p>
                  </div>
                  {/* ATH Móvil integration would be implemented here using:
                      https://github.com/evertec/athmovil-javascript-api */}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm sticky top-4">
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${subtotal?.toFixed(2) || '0.00'}</span>
                </div>
                {tip > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Tip</span>
                    <span>${tip?.toFixed(2) || '0.00'}</span>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
              <Button
                onClick={handlePayment}
                className="w-full mt-4 shadow-sm flex items-center gap-2"
                size="lg"
                disabled={processing || (paymentMethod === 'credit' && (!cardNumber || !cardName || !cardExpiry || !cardCvv))}
              >
                {processing ? (
                  'Processing...'
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Complete Payment
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
