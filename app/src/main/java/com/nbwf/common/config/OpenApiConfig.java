package com.nbwf.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("NBestWorkFinder API")
                        .description("AI 求职工作台 RESTful API 文档，覆盖简历分析、职位工作台、辅助投递、模拟面试和知识库管理")
                        .version("1.0.0"));
    }
}
