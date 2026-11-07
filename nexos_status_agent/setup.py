from setuptools import setup

package_name = "nexos_status_agent"

setup(
    name=package_name,
    version="0.1.0",
    packages=[package_name],
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name]),
        ("share/" + package_name, ["package.xml"]),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="NEXOS.Group",
    maintainer_email="office@nexos.group",
    description="NEXOS ros_status companion node: host vitals to /diagnostics.",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "agent = nexos_status_agent.agent:main",
            "power = nexos_status_agent.power:main",
        ],
    },
)
