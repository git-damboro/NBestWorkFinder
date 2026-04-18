package com.nbwf.modules.knowledgebase.config;

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
 * 知识库表结构轻量校准。
 * 旧库里 `knowledge_bases.file_hash` 是全局唯一，需要迁移为“同一用户内唯一”。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KnowledgeBaseSchemaInitializer implements ApplicationRunner {

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!isPostgreSql()) {
            return;
        }

        if (tableExists("knowledge_bases")) {
            jdbcTemplate.execute("""
                ALTER TABLE knowledge_bases
                ADD COLUMN IF NOT EXISTS user_id BIGINT
                """);
            dropLegacyKnowledgeBaseFileHashConstraint();
            jdbcTemplate.execute("DROP INDEX IF EXISTS idx_kb_hash");
            jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_kb_user_uploaded_at
                ON knowledge_bases (user_id, uploaded_at DESC)
                """);
            jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_kb_user_category
                ON knowledge_bases (user_id, category)
                """);
            jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_kb_user_file_hash
                ON knowledge_bases (user_id, file_hash)
                WHERE user_id IS NOT NULL
                """);
        }

        if (tableExists("rag_chat_sessions")) {
            jdbcTemplate.execute("""
                ALTER TABLE rag_chat_sessions
                ADD COLUMN IF NOT EXISTS user_id BIGINT
                """);
            jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_rag_session_user_updated
                ON rag_chat_sessions (user_id, updated_at DESC)
                """);
        }

        log.info("知识库表索引已校准为用户隔离模式");
    }

    private boolean isPostgreSql() {
        try (Connection connection = dataSource.getConnection()) {
            String productName = connection.getMetaData().getDatabaseProductName();
            return productName != null && productName.toLowerCase().contains("postgresql");
        } catch (SQLException e) {
            log.warn("读取数据库类型失败，跳过知识库表索引校准: {}", e.getMessage());
            return false;
        }
    }

    private boolean tableExists(String tableName) {
        Boolean exists = jdbcTemplate.queryForObject("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = ?
            )
            """, Boolean.class, tableName);
        return Boolean.TRUE.equals(exists);
    }

    private void dropLegacyKnowledgeBaseFileHashConstraint() {
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
                    WHERE rel.relname = 'knowledge_bases'
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
                        'knowledge_bases',
                        constraint_record.conname
                    );
                END LOOP;
            END $$;
            """);
    }
}
