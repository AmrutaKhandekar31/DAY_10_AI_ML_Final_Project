CREATE TABLE public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  facility_type text NOT NULL CHECK (facility_type IN ('Restaurant','Hospital','School','Hotel','Office')),
  location text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.facilities TO anon, authenticated;
GRANT ALL ON public.facilities TO service_role;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Facilities are publicly readable" ON public.facilities FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  inputs jsonb NOT NULL,
  probability numeric(5,4) NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('High','Low')),
  confidence numeric(5,4) NOT NULL,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX predictions_facility_idx ON public.predictions(facility_id);
CREATE INDEX predictions_created_idx ON public.predictions(created_at DESC);
GRANT SELECT ON public.predictions TO anon, authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Predictions are publicly readable" ON public.predictions FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.facilities (name, facility_type, location) VALUES
  ('Green Leaf Bistro','Restaurant','Pune, Koregaon Park'),
  ('City Care Hospital','Hospital','Mumbai, Andheri'),
  ('Sunrise Public School','School','Nashik, College Road'),
  ('Lakeview Residency Hotel','Hotel','Pune, Baner'),
  ('TechPark Tower B','Office','Bengaluru, Whitefield');