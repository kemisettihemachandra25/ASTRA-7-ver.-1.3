-- ============================================================================
-- Seed: Initial High-Resolution Telemetry Streams
-- Provides realistic nominal time-series telemetry for ORION-7 subsystems
-- ============================================================================

INSERT INTO telemetry (satellite_id, subsystem_id, metric_name, metric_value, unit, raw_status, captured_at)
VALUES
    -- EPS Telemetry
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000001', 'battery_soc_pct', 94.2, '%', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000001', 'bus_voltage_v', 28.15, 'V', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000001', 'bus_current_amps', 14.8, 'A', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000001', 'solar_harvest_w', 2420.0, 'W', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000001', 'EPS_BATT_TEMP_CELL04', 21.4, '°C', 'NOMINAL', NOW() - INTERVAL '1 minute'),

    -- ADCS Telemetry
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000002', 'pointing_error_deg', 0.008, 'deg', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000002', 'rw1_speed_rpm', 2450.0, 'RPM', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000002', 'rw2_speed_rpm', 2380.0, 'RPM', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000002', 'rw3_speed_rpm', 2510.0, 'RPM', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000002', 'ADCS_GYRO_Z_RATE', 0.012, 'deg/s', 'NOMINAL', NOW() - INTERVAL '1 minute'),

    -- PROP Telemetry
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000003', 'tank_pressure_bar', 18.4, 'bar', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000003', 'fuel_mass_remaining_kg', 42.18, 'kg', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000003', 'valve_leak_rate_sccm', 0.00, 'sccm', 'NOMINAL', NOW() - INTERVAL '1 minute'),

    -- TCS Telemetry
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000004', 'radiator_temp_c', -12.4, '°C', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000004', 'avionics_bay_temp_c', 19.8, '°C', 'NOMINAL', NOW() - INTERVAL '1 minute'),

    -- COMMS Telemetry
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000005', 'downlink_snr_db', 14.6, 'dB', 'NOMINAL', NOW() - INTERVAL '1 minute'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0001-0000-0000-000000000005', 'packet_error_rate', 0.0001, 'ratio', 'NOMINAL', NOW() - INTERVAL '1 minute');
