
import pandas as pd
from cryptography.fernet import Fernet
from decryption import decryptData



def readEncryptedConfig(excelFilePath,env):
    """
    Reads the encrypted configuration from the Excel file.

    Args:
        excel_file_path (str): The path to the Excel file.

    Returns:
        dict: A dictionary containing the decrypted configuration.
    """
    # Read paths from Excel file
    pathsDf1 = pd.read_excel(excelFilePath)
    pathsDf = pathsDf1[pathsDf1['Env'] == env]
    pathsDict = pathsDf.set_index('Key_name')['Path'].to_dict()

    # Read the encryption key
    keyPath = pathsDict['key_path']
    encryptedFile = pathsDict['encrypted_file']

    # Read the encryption key
    scKey = open(keyPath, 'rb').read()
    cipherSuite = Fernet(scKey)

    # Read the encrypted file
    df = pd.read_csv(encryptedFile)
    #print(df)


    # Decrypt the data
    df_decrypted = df.map(lambda x: decryptData(str(x), keyPath))
    df = pd.DataFrame(df_decrypted)

    # Extract configuration
    config = {
         'host': str(df.at[0, 'host']),
         'database': str(df.at[0, 'database']),
         'user': str(df.at[0, 'user']),
         'password': str(df.at[0, 'password']),
         'port': 3306,
         #'SENDER_EMAIL': str(df.at[0, 'SENDER_EMAIL']),
         #'SENDER_PASSWORD': str(df.at[0, 'SENDER_PASSWORD']),
     }

    return config

