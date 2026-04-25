package com.nbwf.modules.aigeneration.config;

import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AiGenerationTaskSchemaInitializerSqlTest {

    @Test
    void typeConstraintSqlIncludesAllCurrentTaskTypes() {
        String sql = AiGenerationTaskSchemaInitializerSql.typeConstraintSql();

        for (AiGenerationTaskType type : AiGenerationTaskType.values()) {
            assertThat(sql).contains("'" + type.name() + "'");
        }
    }
}
