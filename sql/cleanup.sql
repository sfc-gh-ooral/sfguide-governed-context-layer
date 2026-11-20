-- =============================================================================
-- One Answer Across Agents (governed context layer): cleanup
-- Drops everything sql/setup.sql created. The database drop removes its tables, views,
-- tags, semantic views, Cortex Search service, Cortex Agents, procedures, and task.
-- =============================================================================
USE ROLE ACCOUNTADMIN;

DROP DATABASE IF EXISTS GOVERNED_CONTEXT_DEMO;
DROP WAREHOUSE IF EXISTS GCL_WH;
DROP ROLE IF EXISTS GCL_DEMO_ROLE;
