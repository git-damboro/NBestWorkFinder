package com.nbwf.modules.aigeneration.config;

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
 * AI 生成任务表结构轻量校准。
 * Hibernate ddl-auto=update 不会自动更新旧枚举 check 约束，因此这里在启动时同步当前任务类型。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiGenerationTaskSchemaInitializer implements ApplicationRunner {

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!isPostgreSql() || !tableExists()) {
            return;
        }

        jdbcTemplate.execute(AiGenerationTaskSchemaInitializerSql.typeConstraintSql());
        log.info("AI 生成任务类型约束已校准为当前枚举值");
    }

    private boolean isPostgreSql() {
        try (Connection connection = dataSource.getConnection()) {
            String productName = connection.getMetaData().getDatabaseProductName();
            return productName != null && productName.toLowerCase().contains("postgresql");
        } catch (SQLException e) {
            log.warn("读取数据库类型失败，跳过 AI 生成任务类型约束校准: {}", e.getMessage());
            return false;
        }
    }

    private boolean tableExists() {
        Boolean exists = jdbcTemplate.queryForObject("""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema()
                  AND table_name = 'ai_generation_tasks'
            )
            """, Boolean.class);
        return Boolean.TRUE.equals(exists);
    }
}
