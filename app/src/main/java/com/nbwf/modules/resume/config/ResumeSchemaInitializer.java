package com.nbwf.modules.resume.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * 简历表结构轻量校准。
 * 当前项目使用 Hibernate ddl-auto=update，旧库中的全局 file_hash 唯一索引不会自动删除，
 * 因此这里在 PostgreSQL 启动后将去重约束校准为“同一用户内唯一”。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ResumeSchemaInitializer implements ApplicationRunner {

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!isPostgreSql() || !resumeTableExists()) {
            return;
        }

        dropLegacyGlobalFileHashConstraint();
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_resume_hash");
        jdbcTemplate.execute("""
            CREATE INDEX IF NOT EXISTS idx_resume_user_uploaded_at
            ON resumes (user_id, uploaded_at DESC)
            """);
        jdbcTemplate.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uk_resume_user_file_hash
            ON resumes (user_id, file_hash)
            WHERE user_id IS NOT NULL
            """);

        log.info("简历表索引已校准为用户内唯一去重");
    }

    private boolean isPostgreSql() {
        try (Connection connection = dataSource.getConnection()) {
            String productName = connection.getMetaData().getDatabaseProductName();
            return productName != null && productName.toLowerCase().contains("postgresql");
        } catch (SQLException e) {
            log.warn("读取数据库类型失败，跳过简历表索引校准: {}", e.getMessage());
            return false;
        }
    }

    private boolean resumeTableExists() {
        Boolean exists = jdbcTemplate.queryForObject("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = 'resumes'
            )
            """, Boolean.class);
        return Boolean.TRUE.equals(exists);
    }

    private void dropLegacyGlobalFileHashConstraint() {
        jdbcTemplate.execute("""
            DO $$
            DECLARE
                constraint_record record;
            BEGIN
                FOR constraint_record IN
                    SELECT con.conname
                    FROM pg_constraint con
                    JOIN pg_class rel ON rel.oid = con.conrelid
                    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
                    WHERE rel.relname = 'resumes'
                      AND nsp.nspname = current_schema()
                      AND con.contype = 'u'
                      AND array_length(con.conkey, 1) = 1
                      AND (
                          SELECT att.attname
                          FROM pg_attribute att
                          WHERE att.attrelid = rel.oid
                            AND att.attnum = con.conkey[1]
                      ) = 'file_hash'
                LOOP
                    EXECUTE format(
                        'ALTER TABLE %I.%I DROP CONSTRAINT %I',
                        current_schema(),
                        'resumes',
                        constraint_record.conname
                    );
                END LOOP;
            END $$;
            """);
    }
}
