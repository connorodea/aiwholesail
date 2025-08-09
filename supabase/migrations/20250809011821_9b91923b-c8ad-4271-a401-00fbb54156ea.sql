-- Fix the trigger conflict
DROP TRIGGER IF EXISTS update_property_intelligence_updated_at ON public.property_intelligence;

-- Recreate the trigger
CREATE TRIGGER update_property_intelligence_updated_at
  BEFORE UPDATE ON public.property_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();