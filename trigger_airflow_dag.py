import time
import subprocess
import platform
import paramiko

def trigger_airflow_dag():
    # Airflow command
    start_airflow_cmd = "bash start_airflow.sh"
    command = "/home/ubuntu/run_airflow.sh dags trigger execute_adminFee_Data_Pipeline_v1"

    system_os = platform.system()
    print(f"Detected OS: {system_os}")

    if system_os == "Windows":
        # Ubuntu server details
        hostname = "172.31.25.132"
        username = "ubuntu"  # usually 'ubuntu' for AWS EC2
        pem_file = r"C:\Users\jvineet\Desktop\Cust_t00041.pem"

        try:
            # Create SSH client
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            # Connect to Ubuntu
            ssh.connect(
                hostname=hostname,
                username=username,
                key_filename=pem_file
            )

            print("✅ Connected to Ubuntu server")

            # start QAirflow Services
            print("\nStarting Airflow services.......")
            stdin, stdout, stderr = ssh.exec_command(start_airflow_cmd)

            start_out = stdout.read().decode()
            start_error = stderr.read().decode()

            if start_out:
                print(start_out)
            if start_error:
                print("Error while starting airflow:", start_error)

            print("\nWaiting for Airflow services to initialize.....")
            time.sleep(15)

            # Execute airflow command
            stdin, stdout, stderr = ssh.exec_command(command)

            # Print DAG list
            dags = stdout.read().decode()
            # errors = stderr.read().decode()

            if dags:
                print("\n📌 Airflow DAGs:\n")
                print(dags)

            # if errors:
            #     print("\n⚠️ Errors:\n")
            #     print(errors)

            # ssh.close()

        except Exception as e:
            print("❌ Connection Failed:", str(e))

    else:
        try:
            print("Running on Ubuntu machine")

            print("Starting airflow services.......")
            subprocess.run(start_airflow_cmd, shell=True)
            print("\nWaiting for Airflow services to initialize.....")
            time.sleep(15)
            print("Triggering DAG.......")
            subprocess.run(command, shell=True)

        except Exception as e:
            print(f"error: {e}")



#trigger_airflow_dag()