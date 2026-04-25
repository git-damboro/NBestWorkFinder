package com.nbwf.modules.aigeneration.config;

import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;

import java.util.Arrays;
import java.util.stream.Collectors;

final class AiGenerationTaskSchemaInitializerSql {

    private AiGenerationTaskSchemaInitializerSql() {
    }

    static String typeConstraintSql() {
        String allowedTypes = Arrays.stream(AiGenerationTaskType.values())
                .map(type -> "'" + type.name() + "'")
                .collect(Collectors.joining(", "));

        return """
            ALTER TABLE ai_generation_tasks
            DROP CONSTRAINT IF EXISTS ai_generation_tasks_type_check;

            ALTER TABLE ai_generation_tasks
            ADD CONSTRAINT ai_generation_tasks_type_check
            CHECK (type IN (%s));
            """.formatted(allowedTypes);
    }
}
