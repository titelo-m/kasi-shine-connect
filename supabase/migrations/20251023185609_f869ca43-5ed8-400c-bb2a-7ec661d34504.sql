-- Create profiles table for student information
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  location TEXT NOT NULL,
  municipality TEXT,
  grade INTEGER,
  school_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create performance records table
CREATE TABLE public.performance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  attendance_percentage NUMERIC(5,2),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.performance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own records"
  ON public.performance_records FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own records"
  ON public.performance_records FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Create mentors table
CREATE TABLE public.mentors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  expertise TEXT NOT NULL,
  location TEXT NOT NULL,
  municipality TEXT,
  contact_info TEXT,
  bio TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available mentors"
  ON public.mentors FOR SELECT
  USING (available = true);

-- Create support resources table
CREATE TABLE public.support_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type TEXT NOT NULL, -- 'tutoring', 'psychosocial', 'mentorship', 'career'
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  municipality TEXT,
  contact_info TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available resources"
  ON public.support_resources FOR SELECT
  USING (available = true);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, location, municipality, grade, school_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Student'),
    COALESCE(new.raw_user_meta_data->>'location', ''),
    COALESCE(new.raw_user_meta_data->>'municipality', ''),
    COALESCE((new.raw_user_meta_data->>'grade')::INTEGER, 10),
    COALESCE(new.raw_user_meta_data->>'school_name', '')
  );
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample mentors for Nkangala/Mpumalanga region
INSERT INTO public.mentors (name, expertise, location, municipality, contact_info, bio) VALUES
('Thabo Mthembu', 'Mathematics & Engineering', 'eMalahleni', 'Nkangala', 'thabo.m@email.com', 'Former township student, now civil engineer. Passionate about helping youth see possibilities in STEM.'),
('Nomsa Khumalo', 'Career Guidance & Life Skills', 'Middelburg', 'Nkangala', 'nomsa.k@email.com', 'Community leader and youth counselor with 10 years experience in township education.'),
('Sipho Ndlovu', 'Science & Technology', 'KwaMhlanga', 'Nkangala', 'sipho.n@email.com', 'IT professional giving back to the community. Specializes in science tutoring and tech mentorship.');

-- Insert sample support resources
INSERT INTO public.support_resources (resource_type, name, description, location, municipality, contact_info) VALUES
('tutoring', 'Nkangala Youth Education Hub', 'Free after-school tutoring in Math, Science, and English', 'eMalahleni', 'Nkangala', '013-123-4567'),
('psychosocial', 'Ubuntu Wellness Centre', 'Counseling and mental health support for students', 'Middelburg', 'Nkangala', '013-234-5678'),
('mentorship', 'Future Leaders Program', 'Mentorship program connecting students with professionals', 'KwaMhlanga', 'Nkangala', '013-345-6789'),
('career', 'Skills Development Workshop', 'Career guidance and skills training workshops', 'eMalahleni', 'Nkangala', '013-456-7890');