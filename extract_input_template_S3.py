import pandas as pd
from botocore.client import BaseClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from readEncryptedConfig import readEncryptedConfig
from pathlib import Path
import os
from datetime import datetime, timedelta
import pandas as pd
from sqlalchemy.exc import SQLAlchemyError
from botocore.exceptions import BotoCoreError, ClientError
import boto3

from readMetadata import readMetadata


#reading runtime arguments
# ctxArea = sys.argv[1]
#env = sys.argv[1]
env = "dev"

def extract_input_template():
    # Validate the environment input
    allowed_envs = ["dev", "prod", "demo"]
    if env not in allowed_envs:
        raise ValueError("Invalid environment provided. Allowed values: dev, prod, demo")

    ALLOWED_CONFIG_PATHS = {
        "dev": Path('/home/ubuntu/adminfee_data_pipeline/metadata/Paths.xls'),
        "prod": Path('/home/ubuntu/adminfee_data_pipeline/metadata/Paths.xls'),
        "demo": Path('/home/ubuntu/adminfee_data_pipeline/metadata/Paths.xls')

    }

    # ALLOWED_CONFIG_PATHS_2={
    #     "dev": Path('/home/ubuntu/adminfee_data_pipeline/metadata/input_template.xlsx'),
    #     "prod": Path('/home/ubuntu/adminfee_data_pipeline/metadata/input_template.xlsx'),
    #     "demo": Path('/home/ubuntu/adminfee_data_pipeline/metadata/input_template.xlsx')
    #
    # }

    LOCAL_PATH = '/home/ubuntu/adminfee_data_pipeline/metadata/input_template.xlsx'
    if env not in ALLOWED_CONFIG_PATHS:
        raise ValueError("invalid environment provided")

    full_path = ALLOWED_CONFIG_PATHS[env].resolve()
    # inputTemplateExcelPath = ALLOWED_CONFIG_PATHS_2[env].resolve()
    config = readEncryptedConfig(full_path, env)
    print("Configuration Loaded:", config)

    dbConnection, session, s3FilesTable, awsAccessKeyId, awsSecretAccessKey = readMetadata(config)
    REGION_NAME = 'us-east-1'
    BUCKET_NAME = 'etlhunter'
    S3_KEY = 'adminfee_input/input_template.xlsx'
    # print(awsAccessKeyId)
    # print(awsSecretAccessKey)

    # Create S3 client
    # Create S3 client
    s3Client: BaseClient = boto3.client('s3', aws_access_key_id=awsAccessKeyId,
                                        aws_secret_access_key=awsSecretAccessKey, region_name=REGION_NAME)
    # LOCAL_PATH.parent.mkdir(parents=True, exist_ok=True)

    s3Client.download_file(
        BUCKET_NAME,
        S3_KEY,
        LOCAL_PATH
    )

    print("downloaded")

    return LOCAL_PATH