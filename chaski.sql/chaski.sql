--
-- PostgreSQL database dump
--

\restrict Fop9LaaxaOuJ9xEYyzWuUn5hknQ3BYgDhyzAtXvFn9aTA84d1eNepNKMLbYM8uR

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-05-10 12:35:21

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 18045)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5248 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 18056)
-- Name: associations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.associations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(20) NOT NULL,
    address text,
    phone character varying(20),
    email character varying(100),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.associations OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 18072)
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    association_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    code character varying(20) NOT NULL,
    ruc character varying(11),
    address text,
    phone character varying(20),
    email character varying(100),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 18157)
-- Name: drivers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drivers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    vehicle_id uuid,
    company_id uuid NOT NULL,
    dni character varying(8) NOT NULL,
    first_name character varying(60) NOT NULL,
    last_name character varying(60) NOT NULL,
    phone character varying(20),
    email character varying(100),
    address text,
    photo_url text,
    license_number character varying(20),
    license_type character varying(10),
    license_expiry date,
    iape_qr_url text,
    iape_phone character varying(20),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.drivers OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 18203)
-- Name: exit_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exit_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    route_id uuid NOT NULL,
    queue_date date NOT NULL,
    "position" integer NOT NULL,
    registered_at timestamp without time zone DEFAULT now(),
    status character varying(20) DEFAULT 'waiting'::character varying,
    departure_time timestamp without time zone,
    notes text,
    CONSTRAINT exit_queue_status_check CHECK (((status)::text = ANY ((ARRAY['waiting'::character varying, 'ready'::character varying, 'departed'::character varying, 'absent'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.exit_queue OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 18339)
-- Name: gps_positions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gps_positions (
    id bigint NOT NULL,
    vehicle_id uuid NOT NULL,
    trip_id uuid,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    altitude numeric(7,2),
    speed numeric(5,2),
    heading numeric(5,2),
    accuracy numeric(6,2),
    satellites integer,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    device_id character varying(50)
);


ALTER TABLE public.gps_positions OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 18338)
-- Name: gps_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gps_positions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gps_positions_id_seq OWNER TO postgres;

--
-- TOC entry 5249 (class 0 OID 0)
-- Dependencies: 231
-- Name: gps_positions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gps_positions_id_seq OWNED BY public.gps_positions.id;


--
-- TOC entry 229 (class 1259 OID 18280)
-- Name: manifest_passengers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manifest_passengers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    manifest_id uuid NOT NULL,
    passenger_order integer NOT NULL,
    dni character varying(8),
    full_name character varying(100),
    phone character varying(20),
    origin character varying(100),
    destination character varying(100),
    seat_number integer,
    payment_type character varying(20) NOT NULL,
    fare numeric(8,2) DEFAULT 7.00 NOT NULL,
    boarding_point character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT manifest_passengers_payment_type_check CHECK (((payment_type)::text = ANY ((ARRAY['cash'::character varying, 'yape'::character varying, 'plin'::character varying, 'digital'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.manifest_passengers OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 18239)
-- Name: manifests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manifests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    manifest_number character varying(30) NOT NULL,
    vehicle_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    route_id uuid NOT NULL,
    departure_time timestamp without time zone,
    arrival_time timestamp without time zone,
    status character varying(20) DEFAULT 'open'::character varying,
    total_passengers integer DEFAULT 0,
    cash_passengers integer DEFAULT 0,
    digital_passengers integer DEFAULT 0,
    total_cash numeric(10,2) DEFAULT 0,
    total_digital numeric(10,2) DEFAULT 0,
    total_revenue numeric(10,2) DEFAULT 0,
    pdf_url text,
    whatsapp_sent boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    closed_at timestamp without time zone,
    CONSTRAINT manifests_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'exported'::character varying])::text[])))
);


ALTER TABLE public.manifests OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 18398)
-- Name: route_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.route_alerts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    trip_id uuid,
    alert_type character varying(30) NOT NULL,
    description text,
    location_lat numeric(10,7),
    location_lon numeric(10,7),
    deviation_km numeric(6,2),
    acknowledged boolean DEFAULT false,
    resolved boolean DEFAULT false,
    occurred_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    CONSTRAINT route_alerts_alert_type_check CHECK (((alert_type)::text = ANY ((ARRAY['deviation'::character varying, 'stop'::character varying, 'offline'::character varying, 'unclosed_manifest'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.route_alerts OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 18192)
-- Name: routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.routes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    origin character varying(100) NOT NULL,
    destination character varying(100) NOT NULL,
    distance_km numeric(6,2),
    duration_minutes integer,
    fare numeric(8,2),
    active boolean DEFAULT true
);


ALTER TABLE public.routes OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 18363)
-- Name: speed_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.speed_alerts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    driver_id uuid,
    trip_id uuid,
    max_speed numeric(5,2) NOT NULL,
    speed_limit numeric(5,2) DEFAULT 90.00,
    duration_minutes numeric(5,2),
    location_lat numeric(10,7),
    location_lon numeric(10,7),
    route_section character varying(200),
    severity character varying(20) DEFAULT 'warning'::character varying,
    acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp without time zone,
    occurred_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT speed_alerts_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::text[])))
);


ALTER TABLE public.speed_alerts OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 18424)
-- Name: system_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_alerts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(30) NOT NULL,
    severity character varying(20) DEFAULT 'info'::character varying,
    title character varying(250) NOT NULL,
    message text NOT NULL,
    vehicle_id uuid,
    driver_id uuid,
    reference_id uuid,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT system_alerts_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying, 'success'::character varying])::text[])))
);


ALTER TABLE public.system_alerts OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 18301)
-- Name: trips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trips (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vehicle_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    route_id uuid NOT NULL,
    manifest_id uuid,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    distance_km numeric(6,2),
    avg_speed numeric(5,2),
    max_speed numeric(5,2),
    status character varying(20) DEFAULT 'active'::character varying,
    revenue numeric(10,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT trips_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.trips OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 18105)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    association_id uuid,
    active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'driver'::character varying, 'supervisor'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 18094)
-- Name: vehicle_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    capacity integer NOT NULL,
    description text
);


ALTER TABLE public.vehicle_types OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 18126)
-- Name: vehicles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    association_code character varying(10) NOT NULL,
    plate character varying(10) NOT NULL,
    vehicle_type_id uuid,
    year integer,
    brand character varying(50),
    model character varying(50),
    color character varying(30),
    capacity integer DEFAULT 12 NOT NULL,
    gps_device_id character varying(50),
    gps_phone character varying(20),
    iape_qr_url text,
    iape_phone character varying(20),
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT vehicles_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'maintenance'::character varying])::text[])))
);


ALTER TABLE public.vehicles OWNER TO postgres;

--
-- TOC entry 4969 (class 2604 OID 18342)
-- Name: gps_positions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gps_positions ALTER COLUMN id SET DEFAULT nextval('public.gps_positions_id_seq'::regclass);


--
-- TOC entry 5227 (class 0 OID 18056)
-- Dependencies: 220
-- Data for Name: associations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.associations (id, name, code, address, phone, email, active, created_at, updated_at) FROM stdin;
11111111-1111-1111-1111-111111111111	Asociación de Transportistas TipCar	TIPCAR	Plaza de Armas de Juli, Chucuito, Puno	051-561234	tipcar@transportes.pe	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
\.


--
-- TOC entry 5228 (class 0 OID 18072)
-- Dependencies: 221
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, association_id, name, code, ruc, address, phone, email, active, created_at, updated_at) FROM stdin;
22222222-2222-2222-2222-222222222201	11111111-1111-1111-1111-111111111111	Emp. Transp. Virgen de Fátima	VF	20601234561	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
22222222-2222-2222-2222-222222222202	11111111-1111-1111-1111-111111111111	Emp. Transp. Surandino	SA	20601234562	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
22222222-2222-2222-2222-222222222203	11111111-1111-1111-1111-111111111111	Emp. Transp. San Francisco de Borja	SFB	20601234563	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
22222222-2222-2222-2222-222222222204	11111111-1111-1111-1111-111111111111	Emp. Transp. Virgen de Fátima II	VF2	20601234564	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
22222222-2222-2222-2222-222222222205	11111111-1111-1111-1111-111111111111	Emp. Transp. San Miguel	SM	20601234565	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
\.


--
-- TOC entry 5232 (class 0 OID 18157)
-- Dependencies: 225
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.drivers (id, user_id, vehicle_id, company_id, dni, first_name, last_name, phone, email, address, photo_url, license_number, license_type, license_expiry, iape_qr_url, iape_phone, active, created_at, updated_at) FROM stdin;
39c9fe81-1e83-4271-b03b-3b49edcb5121	3f4aa01b-bcaf-4e5b-8691-9681f048abb6	2e5dceec-6a80-4641-a994-95b0364a4ff2	22222222-2222-2222-2222-222222222201	26172835	Roberto	Flores Limachi	956172835	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
8f302808-bbde-4de7-b814-e9af721fcc3c	e6acfd6d-6542-404b-b459-e44eb6b0d1d3	4b994df3-6e56-40a1-ad0c-e54970dca88b	22222222-2222-2222-2222-222222222203	28641969	David	Condori Mamani	958641969	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
63202c5f-0f49-4b5a-ba1e-806f27c0917a	8ef01f06-424b-4b08-8bf4-89fb75095008	b7bb9463-7cb9-4417-9569-f74704350565	22222222-2222-2222-2222-222222222204	29876536	Felipe	Apaza Torres	959876536	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
cf603f8e-3f5e-4777-ba30-cc4555e8d4ce	dc1a9266-898a-4720-ac24-57939cce3563	2087daef-8870-4f87-b3ad-a59c90ccdc45	22222222-2222-2222-2222-222222222205	31111103	Héctor	Larico Soncco	951111103	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
8087df7c-3b45-4416-bcd9-b844ac46405e	ab90c5a7-0c76-434a-81da-6388ab7a73cd	b07516c6-3dec-4f75-9310-4aeda653e3bd	22222222-2222-2222-2222-222222222201	32345670	Víctor	Limachi Calla	952345670	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
38a5566f-580d-49bd-920c-3332dba4ae39	23d223b2-6f62-4a32-9d35-1d1f0e7866f5	fd3cbce3-db04-4b83-8707-2d6f49192915	22222222-2222-2222-2222-222222222202	33580237	Arturo	Ccama Pari	953580237	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
5dbcf312-0fa2-44b6-b51c-aa9236c01793	9c7767b6-01e9-4482-926b-cce37511b551	69f244a7-7606-458d-9724-17d599147d7e	22222222-2222-2222-2222-222222222203	34814804	Pedro	Soncco Quispe	954814804	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
50ce9b66-957e-4ac5-8a45-0d080587c148	4dd0f4b3-220d-446a-8b14-5227d75e0c08	dfb8bda4-188e-41f0-8f72-4acd21d21d7e	22222222-2222-2222-2222-222222222201	38518505	Antonio	Pari Huanca	958518505	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
93add6ec-4b8e-4bd6-95b8-ae7e274a5fb2	15143326-c414-4602-a0a5-b2516f5a7720	ba14e781-7c84-4dc8-b962-4fb92d5b8fbf	22222222-2222-2222-2222-222222222202	39753072	Raúl	Quispe Flores	959753072	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
6782d1e1-9fa1-4f76-8972-c8040415ce90	0988e4ff-e684-4a25-a8ee-d09d0ca454c6	b365fbe1-7415-4f1c-9c92-bf86e8399806	22222222-2222-2222-2222-222222222203	40987639	Jorge	Mamani Ticona	950987639	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
bfa35f5d-2523-4278-848d-0067104c9bd8	ce4ffd6b-4060-4ef8-933b-4f820a9e96a6	eb90bbd9-243f-46bc-9b47-f62b9be02a4d	22222222-2222-2222-2222-222222222205	43456773	Ernesto	Huanca Larico	953456773	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
637e3928-0ece-448c-a6ff-66d638bac062	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01	bd7e32b4-58b7-4588-9e3e-ad249cc64ab4	22222222-2222-2222-2222-222222222201	40123456	Eloy	Mamani Quispe	951000000	\N	\N	\N	\N	A-IIIb	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
129ae553-a5c6-449f-97b8-f1ae282cdf91	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02	7dd0c9c5-1057-4616-8fd6-ec425c592022	22222222-2222-2222-2222-222222222201	40123457	José	Quispe Flores	951000000	\N	\N	\N	\N	A-IIIb	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
fa189d98-a338-4836-8a11-012ce604d452	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03	a0b407ca-1585-4c14-af03-bc3f8af9df66	22222222-2222-2222-2222-222222222202	40123458	Abraham	Morales Condori	951000000	\N	\N	\N	\N	A-IIIb	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
c3621189-24aa-479f-b92e-5d5a1304fd96	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04	9f90fe20-cf19-498d-b98a-09ea43e93e4e	22222222-2222-2222-2222-222222222202	40123459	Juan	Pérez Huanca	951000000	\N	\N	\N	\N	A-IIIb	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
6251b6df-8575-4328-b112-2dd8d76e327b	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05	33b26d04-9626-4717-955e-1003b99b05a0	22222222-2222-2222-2222-222222222203	40123460	Carlos	Ticona Apaza	951000000	\N	\N	\N	\N	A-IIIb	\N	\N	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
015bfef5-abf7-43f1-b175-0ca0446098c1	be56d042-cd5a-4054-98fb-2aacce3de89f	1da9ecdb-44ae-43d9-beb1-8983447bb4af	22222222-2222-2222-2222-222222222202	27407402	Marcos	Huanca Condori	957407402	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
1ccfde46-678d-4823-97b2-8132acedf6ba	f9f10534-1c4e-46d2-8c4f-2dfd0e8beff4	a1b7c70e-fc4b-4369-b605-7e5e0952d209	22222222-2222-2222-2222-222222222204	36049371	Miguel	Torres Apaza	956049371	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
136046f9-82a3-4863-9aa5-02bb2f0a7990	64c7b33d-557c-4a64-b451-1978d34f1a04	23a5a680-5e2d-42ee-9f39-9dd416d8a347	22222222-2222-2222-2222-222222222205	37283938	Luis	Calla Mamani	957283938	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
36eed1f5-5cc8-4b4b-9274-1cda2c1d3dfc	f7c69398-d241-4d5e-a14e-26d69c3e6be0	053f39d1-d7ea-4cc2-b2b3-eb29717a32b2	22222222-2222-2222-2222-222222222204	42222206	Fernando	Apaza Condori	952222206	\N	\N	\N	\N	\N	\N	\N	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
\.


--
-- TOC entry 5234 (class 0 OID 18203)
-- Dependencies: 227
-- Data for Name: exit_queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exit_queue (id, vehicle_id, driver_id, route_id, queue_date, "position", registered_at, status, departure_time, notes) FROM stdin;
\.


--
-- TOC entry 5239 (class 0 OID 18339)
-- Dependencies: 232
-- Data for Name: gps_positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gps_positions (id, vehicle_id, trip_id, latitude, longitude, altitude, speed, heading, accuracy, satellites, recorded_at, device_id) FROM stdin;
\.


--
-- TOC entry 5236 (class 0 OID 18280)
-- Dependencies: 229
-- Data for Name: manifest_passengers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manifest_passengers (id, manifest_id, passenger_order, dni, full_name, phone, origin, destination, seat_number, payment_type, fare, boarding_point, notes, created_at) FROM stdin;
\.


--
-- TOC entry 5235 (class 0 OID 18239)
-- Dependencies: 228
-- Data for Name: manifests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manifests (id, manifest_number, vehicle_id, driver_id, route_id, departure_time, arrival_time, status, total_passengers, cash_passengers, digital_passengers, total_cash, total_digital, total_revenue, pdf_url, whatsapp_sent, notes, created_at, updated_at, closed_at) FROM stdin;
\.


--
-- TOC entry 5241 (class 0 OID 18398)
-- Dependencies: 234
-- Data for Name: route_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.route_alerts (id, vehicle_id, trip_id, alert_type, description, location_lat, location_lon, deviation_km, acknowledged, resolved, occurred_at, resolved_at) FROM stdin;
\.


--
-- TOC entry 5233 (class 0 OID 18192)
-- Dependencies: 226
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.routes (id, name, origin, destination, distance_km, duration_minutes, fare, active) FROM stdin;
d52a8fb7-ea30-4329-b640-fa22601f7df8	Juli → Puno	Juli	Puno	98.50	80	7.00	t
11ce6616-34b1-42c1-8e04-aed10401950a	Puno → Juli	Puno	Juli	98.50	80	7.00	t
\.


--
-- TOC entry 5240 (class 0 OID 18363)
-- Dependencies: 233
-- Data for Name: speed_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.speed_alerts (id, vehicle_id, driver_id, trip_id, max_speed, speed_limit, duration_minutes, location_lat, location_lon, route_section, severity, acknowledged, acknowledged_by, acknowledged_at, occurred_at) FROM stdin;
\.


--
-- TOC entry 5242 (class 0 OID 18424)
-- Dependencies: 235
-- Data for Name: system_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_alerts (id, type, severity, title, message, vehicle_id, driver_id, reference_id, read, created_at) FROM stdin;
\.


--
-- TOC entry 5237 (class 0 OID 18301)
-- Dependencies: 230
-- Data for Name: trips; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trips (id, vehicle_id, driver_id, route_id, manifest_id, start_time, end_time, distance_km, avg_speed, max_speed, status, revenue, notes, created_at) FROM stdin;
\.


--
-- TOC entry 5230 (class 0 OID 18105)
-- Dependencies: 223
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, role, association_id, active, last_login, created_at, updated_at) FROM stdin;
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	admin.tipcar	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	admin	11111111-1111-1111-1111-111111111111	t	\N	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01	eloy.mamani	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	11111111-1111-1111-1111-111111111111	t	\N	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02	jose.quispe	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	11111111-1111-1111-1111-111111111111	t	\N	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03	abraham.morales	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	11111111-1111-1111-1111-111111111111	t	\N	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04	juan.perez	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	11111111-1111-1111-1111-111111111111	t	\N	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05	carlos.ticona	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	11111111-1111-1111-1111-111111111111	t	\N	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
3f4aa01b-bcaf-4e5b-8691-9681f048abb6	roberto.flores.limachi	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
be56d042-cd5a-4054-98fb-2aacce3de89f	marcos.huanca.condori	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
e6acfd6d-6542-404b-b459-e44eb6b0d1d3	david.condori.mamani	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
8ef01f06-424b-4b08-8bf4-89fb75095008	felipe.apaza.torres	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
dc1a9266-898a-4720-ac24-57939cce3563	hector.larico.soncco	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
ab90c5a7-0c76-434a-81da-6388ab7a73cd	victor.limachi.calla	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
23d223b2-6f62-4a32-9d35-1d1f0e7866f5	arturo.ccama.pari	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
9c7767b6-01e9-4482-926b-cce37511b551	pedro.soncco.quispe	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
f9f10534-1c4e-46d2-8c4f-2dfd0e8beff4	miguel.torres.apaza	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
64c7b33d-557c-4a64-b451-1978d34f1a04	luis.calla.mamani	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
4dd0f4b3-220d-446a-8b14-5227d75e0c08	antonio.pari.huanca	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
15143326-c414-4602-a0a5-b2516f5a7720	raul.quispe.flores	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
0988e4ff-e684-4a25-a8ee-d09d0ca454c6	jorge.mamani.ticona	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
f7c69398-d241-4d5e-a14e-26d69c3e6be0	fernando.apaza.condori	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
ce4ffd6b-4060-4ef8-933b-4f820a9e96a6	ernesto.huanca.larico	$2b$10$rQSXuoiTNlSlmYFKaEQJke5f/XcFoHC5X.qGvCXZSl8YY.DzRENZu	driver	\N	t	\N	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
\.


--
-- TOC entry 5229 (class 0 OID 18094)
-- Dependencies: 222
-- Data for Name: vehicle_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicle_types (id, name, capacity, description) FROM stdin;
c64a50ed-2fa7-4b33-9b10-a3d21369c994	Toyota HiAce 2020+	12	Van mediana de alta capacidad
e0adbe0e-da42-402a-8d32-9623ec7941d0	Mercedes Benz Sprinter	19	Van grande de pasajeros
c8b504b5-2520-4b5d-8c86-a8116506beb9	Renault Master 2020+	15	Van mediana europea
\.


--
-- TOC entry 5231 (class 0 OID 18126)
-- Dependencies: 224
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicles (id, company_id, association_code, plate, vehicle_type_id, year, brand, model, color, capacity, gps_device_id, gps_phone, iape_qr_url, iape_phone, status, notes, active, created_at, updated_at) FROM stdin;
bd7e32b4-58b7-4588-9e3e-ad249cc64ab4	22222222-2222-2222-2222-222222222201	001	PUN-001	\N	2022	Toyota	HiAce	\N	12	\N	\N	\N	\N	active	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
7dd0c9c5-1057-4616-8fd6-ec425c592022	22222222-2222-2222-2222-222222222201	002	PUN-002	\N	2021	Toyota	HiAce	\N	12	\N	\N	\N	\N	active	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
a0b407ca-1585-4c14-af03-bc3f8af9df66	22222222-2222-2222-2222-222222222202	003	PUN-003	\N	2022	Mercedes	Sprinter	\N	19	\N	\N	\N	\N	active	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
9f90fe20-cf19-498d-b98a-09ea43e93e4e	22222222-2222-2222-2222-222222222202	004	PUN-004	\N	2020	Renault	Master	\N	15	\N	\N	\N	\N	active	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
33b26d04-9626-4717-955e-1003b99b05a0	22222222-2222-2222-2222-222222222203	005	PUN-005	\N	2023	Toyota	HiAce	\N	12	\N	\N	\N	\N	active	\N	t	2026-04-17 22:21:27.2075	2026-04-17 22:21:27.2075
2e5dceec-6a80-4641-a994-95b0364a4ff2	22222222-2222-2222-2222-222222222203	006	PUN-006	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
1da9ecdb-44ae-43d9-beb1-8983447bb4af	22222222-2222-2222-2222-222222222204	007	PUN-007	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
4b994df3-6e56-40a1-ad0c-e54970dca88b	22222222-2222-2222-2222-222222222204	008	PUN-008	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
b7bb9463-7cb9-4417-9569-f74704350565	22222222-2222-2222-2222-222222222205	009	PUN-009	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
2087daef-8870-4f87-b3ad-a59c90ccdc45	22222222-2222-2222-2222-222222222205	010	PUN-010	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
b07516c6-3dec-4f75-9310-4aeda653e3bd	22222222-2222-2222-2222-222222222201	011	PUN-011	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
fd3cbce3-db04-4b83-8707-2d6f49192915	22222222-2222-2222-2222-222222222201	012	PUN-012	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
69f244a7-7606-458d-9724-17d599147d7e	22222222-2222-2222-2222-222222222202	013	PUN-013	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
a1b7c70e-fc4b-4369-b605-7e5e0952d209	22222222-2222-2222-2222-222222222202	014	PUN-014	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
23a5a680-5e2d-42ee-9f39-9dd416d8a347	22222222-2222-2222-2222-222222222203	015	PUN-015	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
dfb8bda4-188e-41f0-8f72-4acd21d21d7e	22222222-2222-2222-2222-222222222203	016	PUN-016	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
ba14e781-7c84-4dc8-b962-4fb92d5b8fbf	22222222-2222-2222-2222-222222222204	017	PUN-017	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
b365fbe1-7415-4f1c-9c92-bf86e8399806	22222222-2222-2222-2222-222222222204	018	PUN-018	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
053f39d1-d7ea-4cc2-b2b3-eb29717a32b2	22222222-2222-2222-2222-222222222205	019	PUN-019	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
eb90bbd9-243f-46bc-9b47-f62b9be02a4d	22222222-2222-2222-2222-222222222205	020	PUN-020	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
db545508-cf7b-405d-9bd6-40c378c5c10d	22222222-2222-2222-2222-222222222201	021	PUN-021	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
413f175d-81bd-48cb-a1f4-9e6a49cd6c87	22222222-2222-2222-2222-222222222201	022	PUN-022	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
039f10d2-8cde-4288-aa0e-796da4978935	22222222-2222-2222-2222-222222222202	023	PUN-023	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
86995dc5-cdd7-4a20-846d-73583c75f5f5	22222222-2222-2222-2222-222222222202	024	PUN-024	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
8950cad1-bdea-4fe9-af7e-c7cbea16cd0a	22222222-2222-2222-2222-222222222203	025	PUN-025	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
a154aba7-b443-461b-bf4a-eb12f542d840	22222222-2222-2222-2222-222222222203	026	PUN-026	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
a9c994cb-23f8-446b-91d8-24ac25fdaf94	22222222-2222-2222-2222-222222222204	027	PUN-027	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
4b9ac4a8-d36d-4e25-88f3-e54422d998e2	22222222-2222-2222-2222-222222222204	028	PUN-028	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
5288b36c-f63b-41e2-b937-258c7fe39fe6	22222222-2222-2222-2222-222222222205	029	PUN-029	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
02a73622-c8f5-4e3e-b8e9-3503c049d6ed	22222222-2222-2222-2222-222222222205	030	PUN-030	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
5be39d6f-d820-4a74-bdbd-a545a118272f	22222222-2222-2222-2222-222222222201	031	PUN-031	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
48584331-4430-4675-b595-c6daf5416213	22222222-2222-2222-2222-222222222201	032	PUN-032	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
4a1e64ad-ab5b-4fcd-8320-8e5fdc1d17b0	22222222-2222-2222-2222-222222222202	033	PUN-033	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
501ce9e2-bd2c-4e4f-8d27-299ccd364c63	22222222-2222-2222-2222-222222222202	034	PUN-034	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
9b90c878-4b9b-4c90-80ee-69f9e0f7870c	22222222-2222-2222-2222-222222222203	035	PUN-035	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
4a58706b-ca2a-429b-936b-e3895be2f1bb	22222222-2222-2222-2222-222222222203	036	PUN-036	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
478aced7-3e67-4ba2-b916-fb87d35a539a	22222222-2222-2222-2222-222222222204	037	PUN-037	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
deb28d71-6616-4b88-94b8-c8331af3158a	22222222-2222-2222-2222-222222222204	038	PUN-038	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
ba6fdf8a-248c-450e-b297-29c5ec3ef601	22222222-2222-2222-2222-222222222205	039	PUN-039	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
8b6836f3-75a2-4a65-97e0-9a153201a558	22222222-2222-2222-2222-222222222205	040	PUN-040	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
7d593673-ee2b-4b28-b0ab-c8484fa74ea0	22222222-2222-2222-2222-222222222201	041	PUN-041	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
13e1117a-3d5c-46c8-955c-3cdee9dcc3fd	22222222-2222-2222-2222-222222222201	042	PUN-042	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
9ed52a1d-4e77-4b6b-90bb-5e8b3940a987	22222222-2222-2222-2222-222222222202	043	PUN-043	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
3fc4eb70-4a3e-4984-a57e-e9fc41fa2451	22222222-2222-2222-2222-222222222202	044	PUN-044	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
23e0c60f-b16d-4a9d-a018-6deb64e1035b	22222222-2222-2222-2222-222222222203	045	PUN-045	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
f0d8f69d-9a13-44d6-901a-00ce26b274ec	22222222-2222-2222-2222-222222222203	046	PUN-046	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
fb13ff33-2d19-476d-92ac-e591dfb341b6	22222222-2222-2222-2222-222222222204	047	PUN-047	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
eac4db81-4fc9-4a7b-8541-7d2db072ac9c	22222222-2222-2222-2222-222222222204	048	PUN-048	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
e359082a-efd4-4c72-98cb-304ce593ead3	22222222-2222-2222-2222-222222222205	049	PUN-049	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
d430a89a-f08b-418d-bbe9-c52225beb62a	22222222-2222-2222-2222-222222222205	050	PUN-050	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
520c8d62-e781-485c-85c5-bdba8537c0b1	22222222-2222-2222-2222-222222222201	051	PUN-051	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
5618d941-58e2-4690-8600-e61055afd8ac	22222222-2222-2222-2222-222222222201	052	PUN-052	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
9384d7b6-7e38-4e98-9311-aebb76cc16a2	22222222-2222-2222-2222-222222222202	053	PUN-053	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
e1dae9ce-31f0-4cb8-a725-5daed491e4d1	22222222-2222-2222-2222-222222222202	054	PUN-054	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
3fc9dbfb-b16f-4cd9-a588-a64b8b6159ee	22222222-2222-2222-2222-222222222203	055	PUN-055	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
968d181d-3674-468e-97e4-5e87e29b12c8	22222222-2222-2222-2222-222222222203	056	PUN-056	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
c188ded7-81d7-48bf-9e6f-48c999c8cfb0	22222222-2222-2222-2222-222222222204	057	PUN-057	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
24f56243-4cbf-4716-8d8e-fa515b68a88b	22222222-2222-2222-2222-222222222204	058	PUN-058	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
0b3a1d56-4816-4356-b3b5-982372e0415c	22222222-2222-2222-2222-222222222205	059	PUN-059	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
2b781ba2-1d5a-4612-bf74-f2e41cb0a76d	22222222-2222-2222-2222-222222222205	060	PUN-060	\N	\N	\N	\N	\N	12	\N	\N	\N	\N	active	\N	t	2026-05-09 15:30:58.461479	2026-05-09 15:30:58.461479
\.


--
-- TOC entry 5250 (class 0 OID 0)
-- Dependencies: 231
-- Name: gps_positions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.gps_positions_id_seq', 1, false);


--
-- TOC entry 4994 (class 2606 OID 18071)
-- Name: associations associations_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associations
    ADD CONSTRAINT associations_code_key UNIQUE (code);


--
-- TOC entry 4996 (class 2606 OID 18069)
-- Name: associations associations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.associations
    ADD CONSTRAINT associations_pkey PRIMARY KEY (id);


--
-- TOC entry 4998 (class 2606 OID 18088)
-- Name: companies companies_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_code_key UNIQUE (code);


--
-- TOC entry 5000 (class 2606 OID 18086)
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- TOC entry 5014 (class 2606 OID 18176)
-- Name: drivers drivers_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_dni_key UNIQUE (dni);


--
-- TOC entry 5016 (class 2606 OID 18172)
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- TOC entry 5018 (class 2606 OID 18174)
-- Name: drivers drivers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);


--
-- TOC entry 5023 (class 2606 OID 18219)
-- Name: exit_queue exit_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_queue
    ADD CONSTRAINT exit_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 5025 (class 2606 OID 18221)
-- Name: exit_queue exit_queue_queue_date_position_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_queue
    ADD CONSTRAINT exit_queue_queue_date_position_key UNIQUE (queue_date, "position");


--
-- TOC entry 5027 (class 2606 OID 18223)
-- Name: exit_queue exit_queue_queue_date_vehicle_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_queue
    ADD CONSTRAINT exit_queue_queue_date_vehicle_id_key UNIQUE (queue_date, vehicle_id);


--
-- TOC entry 5042 (class 2606 OID 18350)
-- Name: gps_positions gps_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gps_positions
    ADD CONSTRAINT gps_positions_pkey PRIMARY KEY (id);


--
-- TOC entry 5036 (class 2606 OID 18295)
-- Name: manifest_passengers manifest_passengers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manifest_passengers
    ADD CONSTRAINT manifest_passengers_pkey PRIMARY KEY (id);


--
-- TOC entry 5032 (class 2606 OID 18264)
-- Name: manifests manifests_manifest_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manifests
    ADD CONSTRAINT manifests_manifest_number_key UNIQUE (manifest_number);


--
-- TOC entry 5034 (class 2606 OID 18262)
-- Name: manifests manifests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manifests
    ADD CONSTRAINT manifests_pkey PRIMARY KEY (id);


--
-- TOC entry 5049 (class 2606 OID 18413)
-- Name: route_alerts route_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_alerts
    ADD CONSTRAINT route_alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 5021 (class 2606 OID 18202)
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- TOC entry 5047 (class 2606 OID 18377)
-- Name: speed_alerts speed_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.speed_alerts
    ADD CONSTRAINT speed_alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 5051 (class 2606 OID 18439)
-- Name: system_alerts system_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_alerts
    ADD CONSTRAINT system_alerts_pkey PRIMARY KEY (id);


--
-- TOC entry 5040 (class 2606 OID 18317)
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- TOC entry 5004 (class 2606 OID 18118)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5006 (class 2606 OID 18120)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 5002 (class 2606 OID 18104)
-- Name: vehicle_types vehicle_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_types
    ADD CONSTRAINT vehicle_types_pkey PRIMARY KEY (id);


--
-- TOC entry 5010 (class 2606 OID 18144)
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- TOC entry 5012 (class 2606 OID 18146)
-- Name: vehicles vehicles_plate_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plate_key UNIQUE (plate);


--
-- TOC entry 5019 (class 1259 OID 18452)
-- Name: idx_drivers_vehicle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drivers_vehicle ON public.drivers USING btree (vehicle_id);


--
-- TOC entry 5028 (class 1259 OID 18457)
-- Name: idx_exit_queue_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exit_queue_date ON public.exit_queue USING btree (queue_date);


--
-- TOC entry 5043 (class 1259 OID 18362)
-- Name: idx_gps_trip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gps_trip ON public.gps_positions USING btree (trip_id);


--
-- TOC entry 5044 (class 1259 OID 18361)
-- Name: idx_gps_vehicle_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_gps_vehicle_time ON public.gps_positions USING btree (vehicle_id, recorded_at DESC);


--
-- TOC entry 5029 (class 1259 OID 18454)
-- Name: idx_manifests_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_manifests_date ON public.manifests USING btree (created_at);


--
-- TOC entry 5030 (class 1259 OID 18453)
-- Name: idx_manifests_vehicle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_manifests_vehicle ON public.manifests USING btree (vehicle_id);


--
-- TOC entry 5045 (class 1259 OID 18458)
-- Name: idx_speed_alerts_vehicle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_speed_alerts_vehicle ON public.speed_alerts USING btree (vehicle_id);


--
-- TOC entry 5037 (class 1259 OID 18456)
-- Name: idx_trips_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_trips_date ON public.trips USING btree (start_time);


--
-- TOC entry 5038 (class 1259 OID 18455)
-- Name: idx_trips_vehicle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_trips_vehicle ON public.trips USING btree (vehicle_id);


--
-- TOC entry 5007 (class 1259 OID 18451)
-- Name: idx_vehicles_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vehicles_code ON public.vehicles USING btree (association_code);


--
-- TOC entry 5008 (class 1259 OID 18450)
-- Name: idx_vehicles_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vehicles_company ON public.vehicles USING btree (company_id);


--
-- TOC entry 5052 (class 2606 OID 18089)
-- Name: companies companies_association_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_association_id_fkey FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- TOC entry 5056 (class 2606 OID 18187)
-- Name: drivers drivers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- TOC entry 5057 (class 2606 OID 18177)
-- Name: drivers drivers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 5058 (class 2606 OID 18182)
-- Name: drivers drivers_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 5059 (class 2606 OID 18229)
-- Name: exit_queue exit_queue_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_queue
    ADD CONSTRAINT exit_queue_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- TOC entry 5060 (class 2606 OID 18234)
-- Name: exit_queue exit_queue_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_queue
    ADD CONSTRAINT exit_queue_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- TOC entry 5061 (class 2606 OID 18224)
-- Name: exit_queue exit_queue_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exit_queue
    ADD CONSTRAINT exit_queue_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 5070 (class 2606 OID 18356)
-- Name: gps_positions gps_positions_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gps_positions
    ADD CONSTRAINT gps_positions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- TOC entry 5071 (class 2606 OID 18351)
-- Name: gps_positions gps_positions_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gps_positions
    ADD CONSTRAINT gps_positions_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 5065 (class 2606 OID 18296)
-- Name: manifest_passengers manifest_passengers_manifest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manifest_passengers
    ADD CONSTRAINT manifest_passengers_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES public.manifests(id) ON DELETE CASCADE;


--
-- TOC entry 5062 (class 2606 OID 18270)
-- Name: manifests manifests_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manifests
    ADD CONSTRAINT manifests_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- TOC entry 5063 (class 2606 OID 18275)
-- Name: manifests manifests_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manifests
    ADD CONSTRAINT manifests_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- TOC entry 5064 (class 2606 OID 18265)
-- Name: manifests manifests_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manifests
    ADD CONSTRAINT manifests_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 5076 (class 2606 OID 18419)
-- Name: route_alerts route_alerts_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_alerts
    ADD CONSTRAINT route_alerts_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- TOC entry 5077 (class 2606 OID 18414)
-- Name: route_alerts route_alerts_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.route_alerts
    ADD CONSTRAINT route_alerts_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 5072 (class 2606 OID 18393)
-- Name: speed_alerts speed_alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.speed_alerts
    ADD CONSTRAINT speed_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id);


--
-- TOC entry 5073 (class 2606 OID 18383)
-- Name: speed_alerts speed_alerts_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.speed_alerts
    ADD CONSTRAINT speed_alerts_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- TOC entry 5074 (class 2606 OID 18388)
-- Name: speed_alerts speed_alerts_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.speed_alerts
    ADD CONSTRAINT speed_alerts_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- TOC entry 5075 (class 2606 OID 18378)
-- Name: speed_alerts speed_alerts_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.speed_alerts
    ADD CONSTRAINT speed_alerts_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 5078 (class 2606 OID 18445)
-- Name: system_alerts system_alerts_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_alerts
    ADD CONSTRAINT system_alerts_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- TOC entry 5079 (class 2606 OID 18440)
-- Name: system_alerts system_alerts_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_alerts
    ADD CONSTRAINT system_alerts_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 5066 (class 2606 OID 18323)
-- Name: trips trips_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- TOC entry 5067 (class 2606 OID 18333)
-- Name: trips trips_manifest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_manifest_id_fkey FOREIGN KEY (manifest_id) REFERENCES public.manifests(id);


--
-- TOC entry 5068 (class 2606 OID 18328)
-- Name: trips trips_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- TOC entry 5069 (class 2606 OID 18318)
-- Name: trips trips_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- TOC entry 5053 (class 2606 OID 18121)
-- Name: users users_association_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_association_id_fkey FOREIGN KEY (association_id) REFERENCES public.associations(id);


--
-- TOC entry 5054 (class 2606 OID 18147)
-- Name: vehicles vehicles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- TOC entry 5055 (class 2606 OID 18152)
-- Name: vehicles vehicles_vehicle_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_vehicle_type_id_fkey FOREIGN KEY (vehicle_type_id) REFERENCES public.vehicle_types(id);


-- Completed on 2026-05-10 12:35:21

--
-- PostgreSQL database dump complete
--

\unrestrict Fop9LaaxaOuJ9xEYyzWuUn5hknQ3BYgDhyzAtXvFn9aTA84d1eNepNKMLbYM8uR

