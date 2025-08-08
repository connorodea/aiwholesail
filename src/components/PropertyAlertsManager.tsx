import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Bell, MapPin, DollarSign, Home, Calendar, Send } from 'lucide-react';
import { toast } from 'sonner';
import { LocationAutocomplete } from './LocationAutocomplete';

interface PropertyAlert {
  id: string;
  location: string;
  max_price?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  min_bathrooms?: number;
  max_bathrooms?: number;
  min_sqft?: number;
  max_sqft?: number;
  property_types: string[];
  alert_frequency: 'immediate' | 'daily' | 'weekly';
  is_active: boolean;
  last_alert_sent?: string;
  created_at: string;
}

interface NewAlert {
  location: string;
  max_price: string;
  min_bedrooms: string;
  max_bedrooms: string;
  min_bathrooms: string;
  max_bathrooms: string;
  min_sqft: string;
  max_sqft: string;
  property_types: string[];
  alert_frequency: 'immediate' | 'daily' | 'weekly';
}

const PROPERTY_TYPES = ['Houses', 'Townhomes', 'Multi-family', 'Condos/Co-ops'];

export const PropertyAlertsManager = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PropertyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewAlert, setShowNewAlert] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [newAlert, setNewAlert] = useState<NewAlert>({
    location: '',
    max_price: '',
    min_bedrooms: '',
    max_bedrooms: '',
    min_bathrooms: '',
    max_bathrooms: '',
    min_sqft: '',
    max_sqft: '',
    property_types: PROPERTY_TYPES,
    alert_frequency: 'immediate'
  });

  useEffect(() => {
    if (user) {
      fetchAlerts();
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('property_alerts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts((data || []) as PropertyAlert[]);
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      toast.error('Failed to load property alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!newAlert.location.trim()) {
      toast.error('Please enter a location');
      return;
    }

    // Check subscription limits
    const maxAlerts = getMaxAlerts();
    if (alerts.length >= maxAlerts) {
      toast.error(`You've reached the maximum of ${maxAlerts} alerts for your plan. Upgrade to add more locations.`);
      return;
    }

    setCreating(true);
    try {
      const alertData = {
        user_id: user?.id,
        location: newAlert.location.trim(),
        max_price: newAlert.max_price ? parseFloat(newAlert.max_price) : null,
        min_bedrooms: newAlert.min_bedrooms ? parseInt(newAlert.min_bedrooms) : null,
        max_bedrooms: newAlert.max_bedrooms ? parseInt(newAlert.max_bedrooms) : null,
        min_bathrooms: newAlert.min_bathrooms ? parseFloat(newAlert.min_bathrooms) : null,
        max_bathrooms: newAlert.max_bathrooms ? parseFloat(newAlert.max_bathrooms) : null,
        min_sqft: newAlert.min_sqft ? parseInt(newAlert.min_sqft) : null,
        max_sqft: newAlert.max_sqft ? parseInt(newAlert.max_sqft) : null,
        property_types: newAlert.property_types,
        alert_frequency: newAlert.alert_frequency,
        is_active: true
      };

      const { error } = await supabase
        .from('property_alerts')
        .insert(alertData);

      if (error) throw error;

      toast.success('Property alert created successfully!');
      setShowNewAlert(false);
      setNewAlert({
        location: '',
        max_price: '',
        min_bedrooms: '',
        max_bedrooms: '',
        min_bathrooms: '',
        max_bathrooms: '',
        min_sqft: '',
        max_sqft: '',
        property_types: PROPERTY_TYPES,
        alert_frequency: 'immediate'
      });
      fetchAlerts();
    } catch (error: any) {
      console.error('Error creating alert:', error);
      toast.error('Failed to create property alert');
    } finally {
      setCreating(false);
    }
  };

  const toggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('property_alerts')
        .update({ is_active: isActive })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, is_active: isActive } : alert
      ));

      toast.success(`Alert ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      console.error('Error toggling alert:', error);
      toast.error('Failed to update alert');
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('property_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(alerts.filter(alert => alert.id !== alertId));
      toast.success('Alert deleted successfully');
    } catch (error: any) {
      console.error('Error deleting alert:', error);
      toast.error('Failed to delete alert');
    }
  };

  const sendTestAlert = async (alert: PropertyAlert) => {
    try {
      const { data, error } = await supabase.functions.invoke('test-property-alert', {
        body: {
          userEmail: user?.email,
          location: alert.location
        }
      });

      if (error) throw error;

      toast.success(`Test alert sent to ${user?.email} for ${alert.location}!`);
    } catch (error: any) {
      console.error('Error sending test alert:', error);
      toast.error('Failed to send test alert');
    }
  };

  const formatCriteria = (alert: PropertyAlert) => {
    const criteria = [];
    
    if (alert.max_price) criteria.push(`Max $${alert.max_price.toLocaleString()}`);
    if (alert.min_bedrooms) criteria.push(`${alert.min_bedrooms}+ beds`);
    if (alert.max_bedrooms) criteria.push(`${alert.max_bedrooms}- beds`);
    if (alert.min_bathrooms) criteria.push(`${alert.min_bathrooms}+ baths`);
    if (alert.max_bathrooms) criteria.push(`${alert.max_bathrooms}- baths`);
    if (alert.min_sqft) criteria.push(`${alert.min_sqft}+ sqft`);
    if (alert.max_sqft) criteria.push(`${alert.max_sqft}- sqft`);

    return criteria.length > 0 ? criteria.join(', ') : 'No specific criteria';
  };

  const getMaxAlerts = () => {
    if (!subscription?.subscribed) return 1; // Free tier: 1 alert
    if (subscription?.subscription_tier === 'Premium') return 999; // $99 plan: unlimited
    return 5; // $29 plan: 5 alerts
  };

  const getUpdateFrequency = () => {
    if (!subscription?.subscribed) return 'Manual only';
    if (subscription?.subscription_tier === 'Premium') return 'Every 4 hours';
    return 'Every 24 hours';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Property Alerts
          </h2>
          <p className="text-muted-foreground">
            Get notified when new wholesale opportunities match your criteria
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-muted-foreground">
              Plan: {subscription?.subscribed ? 
                (subscription?.subscription_tier === 'Premium' ? 'Premium ($99/month)' : 'Basic ($29/month)') : 
                'Free'
              }
            </span>
            <span className="text-muted-foreground">
              Locations: {alerts.length}/{getMaxAlerts() === 999 ? '∞' : getMaxAlerts()}
            </span>
            <span className="text-muted-foreground">
              Updates: {getUpdateFrequency()}
            </span>
          </div>
        </div>
        <Button 
          onClick={() => setShowNewAlert(true)}
          disabled={alerts.length >= getMaxAlerts()}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Alert
        </Button>
      </div>

      {showNewAlert && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Property Alert</CardTitle>
            <CardDescription>
              Set up criteria to receive notifications for matching properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="location">Location *</Label>
                <LocationAutocomplete
                  value={newAlert.location}
                  onChange={(value) => setNewAlert({ ...newAlert, location: value })}
                  placeholder="Enter city, state, or ZIP code"
                />
              </div>

              <div>
                <Label htmlFor="max_price">Max Price</Label>
                <Input
                  id="max_price"
                  type="number"
                  placeholder="e.g., 500000"
                  value={newAlert.max_price}
                  onChange={(e) => setNewAlert({ ...newAlert, max_price: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="alert_frequency">Alert Frequency</Label>
                <Select 
                  value={newAlert.alert_frequency} 
                  onValueChange={(value: 'immediate' | 'daily' | 'weekly') => 
                    setNewAlert({ ...newAlert, alert_frequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="daily">Daily Summary</SelectItem>
                    <SelectItem value="weekly">Weekly Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="min_bedrooms">Min Bedrooms</Label>
                <Input
                  id="min_bedrooms"
                  type="number"
                  placeholder="e.g., 3"
                  value={newAlert.min_bedrooms}
                  onChange={(e) => setNewAlert({ ...newAlert, min_bedrooms: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="max_bedrooms">Max Bedrooms</Label>
                <Input
                  id="max_bedrooms"
                  type="number"
                  placeholder="e.g., 5"
                  value={newAlert.max_bedrooms}
                  onChange={(e) => setNewAlert({ ...newAlert, max_bedrooms: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="min_sqft">Min Sq Ft</Label>
                <Input
                  id="min_sqft"
                  type="number"
                  placeholder="e.g., 1200"
                  value={newAlert.min_sqft}
                  onChange={(e) => setNewAlert({ ...newAlert, min_sqft: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="max_sqft">Max Sq Ft</Label>
                <Input
                  id="max_sqft"
                  type="number"
                  placeholder="e.g., 3000"
                  value={newAlert.max_sqft}
                  onChange={(e) => setNewAlert({ ...newAlert, max_sqft: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button 
                onClick={handleCreateAlert} 
                disabled={creating}
                className="flex items-center gap-2"
              >
                {creating ? 'Creating...' : 'Create Alert'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowNewAlert(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Property Alerts Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first alert to get notified of wholesale opportunities
              </p>
              <Button onClick={() => setShowNewAlert(true)}>
                Create Your First Alert
              </Button>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert) => (
            <Card key={alert.id} className={`transition-all ${alert.is_active ? 'ring-2 ring-primary/20' : 'opacity-60'}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">{alert.location}</h3>
                      <Badge variant={alert.is_active ? "default" : "secondary"}>
                        {alert.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">
                        {alert.alert_frequency}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="h-4 w-4" />
                        <span>{formatCriteria(alert)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        <span>{alert.property_types.join(', ')}</span>
                      </div>
                      {alert.last_alert_sent && (
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4" />
                          <span>Last alert: {new Date(alert.last_alert_sent).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Switch 
                      checked={alert.is_active}
                      onCheckedChange={(checked) => toggleAlert(alert.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendTestAlert(alert)}
                      className="text-primary hover:text-primary"
                      title="Send test alert"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAlert(alert.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};