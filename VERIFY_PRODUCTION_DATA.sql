-- ============================================
-- VERIFY PRODUCTION DATA - RUN THIS FIRST
-- ============================================
-- This script checks if business_id columns exist and are populated
-- Run this BEFORE fix_production_schema.sql to see the current state

-- Check clients table
SELECT 
  'clients' as table_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'business_id'
  ) as has_business_id_column,
  COUNT(*) as total_records,
  COUNT(business_id) FILTER (WHERE business_id IS NOT NULL) as records_with_business_id,
  COUNT(DISTINCT business_id) as unique_business_ids,
  STRING_AGG(DISTINCT business_id::text, ', ') as business_ids_found
FROM public.clients;

-- Check services table
SELECT 
  'services' as table_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'services' 
    AND column_name = 'business_id'
  ) as has_business_id_column,
  COUNT(*) as total_records,
  COUNT(business_id) FILTER (WHERE business_id IS NOT NULL) as records_with_business_id,
  COUNT(DISTINCT business_id) as unique_business_ids,
  STRING_AGG(DISTINCT business_id::text, ', ') as business_ids_found
FROM public.services;

-- Check pets table
SELECT 
  'pets' as table_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pets' 
    AND column_name = 'business_id'
  ) as has_business_id_column,
  COUNT(*) as total_records,
  COUNT(business_id) FILTER (WHERE business_id IS NOT NULL) as records_with_business_id,
  COUNT(DISTINCT business_id) as unique_business_ids,
  STRING_AGG(DISTINCT business_id::text, ', ') as business_ids_found
FROM public.pets;

-- Check appointments table
SELECT 
  'appointments' as table_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'business_id'
  ) as has_business_id_column,
  COUNT(*) as total_records,
  COUNT(business_id) FILTER (WHERE business_id IS NOT NULL) as records_with_business_id,
  COUNT(DISTINCT business_id) as unique_business_ids,
  STRING_AGG(DISTINCT business_id::text, ', ') as business_ids_found
FROM public.appointments;
